import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildPrompt, callClaude, mockExtraction, runChecks } from '@/lib/ai/extract';

// POST /api/v1/extract { document_id }  →  { fields, checks, model }
// - solo utenti attivi che possono registrare (non sola lettura);
// - solo se l'amministratore ha attivato la lettura IA (impostazione ai_reading, dopo l'accordo sul trattamento dei dati);
// - il file si scarica con i permessi dell'utente; la chiave dell'API resta sul server.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const MAX_BYTES = 4.5 * 1024 * 1024;   // limite per immagine dell'API, con margine per la codifica

const fail = (code: string, status: number) => NextResponse.json({ error: code }, { status });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail('unauthenticated', 401);
  const { data: me } = await supabase.from('profiles').select('role, active, lang').eq('id', auth.user.id).maybeSingle();
  if (!me?.active || me.role === 'read_only') return fail('forbidden', 403);

  const { data: setting } = await supabase.from('settings').select('value').eq('key', 'ai_reading').maybeSingle();
  if (setting?.value !== true) return fail('ai_disabled', 403);
  const mock = process.env.AI_MOCK === '1';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!mock && !apiKey) return fail('ai_not_configured', 503);

  const { document_id } = await req.json().catch(() => ({}));
  if (typeof document_id !== 'string') return fail('invalid', 400);
  const { data: doc } = await supabase.from('documents')
    .select('id, version, original_path, enhanced_path, mime').eq('id', document_id).maybeSingle();
  if (!doc) return fail('not_found', 404);

  const lang = me.lang === 'fr' ? 'fr' : 'it';
  const { data: cats } = await supabase.from('categories').select('code, name_it, name_fr').eq('active', true).order('sort');
  const categories = (cats ?? []).map((c) => ({ code: c.code, name: lang === 'fr' && c.name_fr ? c.name_fr : c.name_it }));
  const model = process.env.AI_MODEL || 'claude-haiku-4-5';

  let extraction;
  let usage = { input_tokens: 0, output_tokens: 0 };
  if (mock) {
    extraction = mockExtraction();
  } else {
    const path = doc.enhanced_path ?? doc.original_path;
    const { data: blob, error } = await supabase.storage.from('documents').download(path);
    if (error || !blob) return fail('file_unavailable', 404);
    if (blob.size > MAX_BYTES) return fail('file_too_large', 413);
    const mime = doc.enhanced_path ? 'image/jpeg' : doc.mime;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'].includes(mime)) return fail('unsupported_type', 415);
    try {
      ({ extraction, usage } = await callClaude({
        apiKey: apiKey!, model, prompt: buildPrompt(categories, lang),
        file: { base64: Buffer.from(await blob.arrayBuffer()).toString('base64'), mime },
      }));
    } catch (e) {
      return fail((e as Error).message.startsWith('ai_') ? (e as Error).message : 'ai_invalid_output', 502);
    }
  }
  const checks = runChecks(extraction);
  const usedModel = mock ? 'mock' : model;
  // salva la lettura sul documento (con i permessi dell'utente): resta tracciata anche se poi viene corretta
  await supabase.rpc('update_document', {
    p: { id: doc.id, extraction: { fields: extraction, checks, model: usedModel, usage, at: new Date().toISOString() }, extraction_model: usedModel },
  });
  return NextResponse.json({ fields: extraction, checks, model: usedModel });
}
