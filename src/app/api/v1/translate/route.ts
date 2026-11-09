import { NextResponse, type NextRequest } from 'next/server';
import { aiGate } from '@/lib/ai/gate';
import { callText, FAST_MODEL } from '@/lib/ai/text';

// POST /api/v1/translate { ids: string[] } → { done }
// Traduce in italiano e in francese la descrizione dei movimenti indicati che non hanno ancora la traduzione
// (o l'hanno di una descrizione poi cambiata). Al massimo 40 per chiamata. I movimenti si leggono con i permessi dell'utente.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Row = { id: string; description: string };

export async function POST(req: NextRequest) {
  const g = await aiGate({ write: true });
  if ('error' in g) return g.error;
  const { supabase, mock, apiKey } = g;
  const body = await req.json().catch(() => ({}));
  const ids = (Array.isArray(body.ids) ? body.ids : []).filter((x: unknown) => typeof x === 'string' && /^[0-9a-f-]{36}$/.test(x)).slice(0, 40) as string[];
  if (!ids.length) return NextResponse.json({ done: 0 });
  const [{ data: movs }, { data: trs }] = await Promise.all([
    supabase.from('movements').select('id, description').in('id', ids).returns<Row[]>(),
    supabase.from('movement_translations').select('movement_id, source').in('movement_id', ids),
  ]);
  const have = new Map((trs ?? []).map((t) => [t.movement_id as string, t.source as string]));
  const todo = (movs ?? []).filter((m) => m.description.trim().length >= 2 && have.get(m.id) !== m.description);
  if (!todo.length) return NextResponse.json({ done: 0 });

  let out: { id: string; src: string; it: string; fr: string }[];
  if (mock) {
    out = todo.map((m) => ({ id: m.id, src: 'it', it: m.description, fr: `[FR] ${m.description}` }));
  } else {
    const prompt = `Descrizioni di movimenti contabili di un'associazione italiana che lavora in Madagascar.
Per ciascuna: riconosci se è scritta in italiano ("it") o in francese ("fr") e dai il testo in entrambe le lingue.
Regole: traduzione fedele e naturale, stessa lunghezza circa; non tradurre nomi propri, nomi di scuole e progetti (es. École Piccolino), sigle, numeri, riferimenti (MOV-…, fatture); lascia invariato il testo nella lingua d'origine.
Rispondi solo con un array JSON: [{"id":"…","src":"it"|"fr","it":"…","fr":"…"}].

${JSON.stringify(todo.map((m) => ({ id: m.id, text: m.description })))}`;
    try {
      const text = await callText({ apiKey, model: FAST_MODEL(), system: 'Sei un traduttore professionale italiano-francese per testi contabili. Rispondi solo con JSON valido.', prompt, maxTokens: 4000 });
      const json = text.match(/\[[\s\S]*\]/);
      out = json ? JSON.parse(json[0]) : [];
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message.startsWith('ai_') ? (e as Error).message : 'ai_invalid_output' }, { status: 502 });
    }
  }
  const valid = out.filter((o) => todo.some((m) => m.id === o.id) && (o.src === 'it' || o.src === 'fr') && o.it && o.fr);
  const { data: n, error } = await supabase.rpc('movement_translations_save', { p: valid, p_model: mock ? 'mock' : FAST_MODEL() });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ done: n ?? 0 });
}
