import { NextResponse, type NextRequest } from 'next/server';
import { aiGate } from '@/lib/ai/gate';
import { callText, MAIN_MODEL } from '@/lib/ai/text';

// POST /api/v1/ask { q, year, history? } → { answer }
// «Chiedi all'AI»: risponde a domande sui conti dell'anno con un riepilogo dei dati che l'utente può vedere
// (letti con i suoi permessi). Non modifica nulla. Nessun dato personale delle controparti.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Led = { month: number; kind: string; amount_eur: string | null; project_name: string | null; category_id: string | null };

export async function POST(req: NextRequest) {
  const g = await aiGate();
  if ('error' in g) return g.error;
  const { supabase, me, mock, apiKey } = g;
  const body = await req.json().catch(() => ({}));
  const q = String(body.q ?? '').trim().slice(0, 600);
  const year = Number(body.year) || new Date().getFullYear();
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6)
    .map((h: { q?: string; a?: string }) => ({ q: String(h.q ?? '').slice(0, 600), a: String(h.a ?? '').slice(0, 1500) }));
  if (q.length < 3) return NextResponse.json({ error: 'empty' }, { status: 400 });
  const lang = me.lang === 'fr' ? 'fr' : 'it';

  const [{ data: led }, { data: prev }, { data: bal }, { data: cats }, { data: cmp }, { data: fx }, { count: toVerify }, { count: due }, { data: dls }, { data: big }] = await Promise.all([
    supabase.from('v_ledger').select('month, kind, amount_eur, project_name, category_id').eq('year', year).neq('kind', 'transfer')
      .eq('out_of_report', false).limit(50000).returns<Led[]>(),
    supabase.from('v_ledger').select('month, kind, amount_eur').eq('year', year - 1).neq('kind', 'transfer').eq('out_of_report', false).limit(50000),
    supabase.rpc('account_balances'),
    supabase.from('categories').select('id, code, name_it, name_fr, direction, group:category_groups(code, name_it, name_fr)'),
    supabase.rpc('budget_compare', { p_year: year }),
    supabase.from('fx_rates').select('year, month, rate').order('year', { ascending: false }).order('month', { ascending: false }).limit(13),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('status', 'recorded'),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('reimb_status', 'due'),
    supabase.from('deadlines').select('title, due_date, status').eq('status', 'open').order('due_date').limit(10),
    supabase.from('movements').select('op_date, description, amount_eur, project:projects(name)').eq('kind', 'expense').neq('status', 'draft')
      .is('reverses_id', null).gte('op_date', `${year}-01-01`).lte('op_date', `${year}-12-31`).order('amount_eur', { ascending: false, nullsFirst: false }).limit(20),
  ]);
  const r0 = (v: number) => Math.round(v);
  const catBy = new Map(((cats ?? []) as unknown as { id: string; code: string; name_it: string; name_fr: string | null; group: { code: string; name_it: string } | null }[])
    .map((c) => [c.id, c]));
  const months = Array.from({ length: 12 }, (_, i) => ({ mese: i + 1, entrate: 0, uscite: 0 }));
  const byPrj = new Map<string, { entrate: number; uscite: number }>();
  const byCode = new Map<string, number>();
  for (const l of led ?? []) {
    const v = Number(l.amount_eur ?? 0);
    const k = l.kind === 'income' ? 'entrate' : 'uscite';
    months[l.month - 1][k] += v;
    const p = byPrj.get(l.project_name ?? '–') ?? { entrate: 0, uscite: 0 }; p[k] += v; byPrj.set(l.project_name ?? '–', p);
    if (l.kind === 'expense') { const c = l.category_id ? catBy.get(l.category_id) : null; const key = c ? `${c.code} ${c.name_it}` : 'senza codice'; byCode.set(key, (byCode.get(key) ?? 0) + v); }
  }
  const prevM = Array.from({ length: 12 }, (_, i) => ({ mese: i + 1, entrate: 0, uscite: 0 }));
  for (const l of (prev ?? []) as { month: number; kind: string; amount_eur: string | null }[]) prevM[l.month - 1][l.kind === 'income' ? 'entrate' : 'uscite'] += Number(l.amount_eur ?? 0);
  const topSpese = ((big ?? []) as unknown as { op_date: string; description: string; amount_eur: string | null; project: { name: string } | null }[])
    .map((l) => ({ data: l.op_date, descrizione: l.description.slice(0, 120), progetto: l.project?.name ?? null, euro: r0(Number(l.amount_eur ?? 0)) }));
  type Cm = { direction: string; category_code: string; cat_it: string; project_name: string | null; budget_eur: string; actual_eur: string; committed_eur: string };
  const prev_ = (cmp ?? []) as Cm[];
  const ctx = {
    oggi: new Date().toISOString().slice(0, 10), anno: year, valuta: 'EUR (importi in ariary convertiti al tasso del movimento)',
    mesi: months.map((m) => ({ ...m, entrate: r0(m.entrate), uscite: r0(m.uscite) })),
    anno_precedente_mesi: prevM.map((m) => ({ ...m, entrate: r0(m.entrate), uscite: r0(m.uscite) })),
    per_progetto: [...byPrj].map(([p, v]) => ({ progetto: p, entrate: r0(v.entrate), uscite: r0(v.uscite) })).sort((a, b) => b.uscite - a.uscite),
    uscite_per_codice: [...byCode].map(([c, v]) => ({ codice: c, euro: r0(v) })).sort((a, b) => b.euro - a.euro).slice(0, 40),
    preventivo_vs_consuntivo: prev_.filter((x) => Number(x.budget_eur) || Number(x.actual_eur)).slice(0, 120).map((x) => ({
      tipo: x.direction === 'in' ? 'entrata' : 'uscita', codice: x.category_code, voce: x.cat_it, progetto: x.project_name,
      previsto: r0(Number(x.budget_eur)), eseguito: r0(Number(x.actual_eur)), impegnato: r0(Number(x.committed_eur)) })),
    saldi_conti: ((bal ?? []) as { name_it: string; currency: string; balance: string; kind: string }[]).filter((b) => b.kind !== 'advance')
      .map((b) => ({ conto: b.name_it, valuta: b.currency, saldo: r0(Number(b.balance)) })),
    tassi_mga_per_eur: (fx ?? []).map((f) => ({ anno: f.year, mese: f.month, tasso: Number(f.rate) })),
    movimenti_da_verificare: toVerify ?? 0, spese_da_rimborsare: due ?? 0,
    scadenze_aperte: (dls ?? []).map((d) => ({ titolo: d.title, data: d.due_date })),
    spese_maggiori: topSpese,
  };

  let answer: string;
  if (mock) {
    const out = months.reduce((s, m) => s + m.uscite, 0);
    answer = lang === 'fr' ? `Réponse simulée : dépenses ${year} ${r0(out)} €.` : `Risposta simulata: uscite ${year} ${r0(out)} €.`;
  } else {
    const system = `Sei l'assistente contabile di YouCount, l'app di contabilità di YouSud ODV (associazione italiana che lavora in Madagascar).
Rispondi in ${lang === 'fr' ? 'francese' : 'italiano'}, in modo breve e chiaro, con frasi semplici ed elenchi solo se servono.
Usa SOLO i dati del contesto JSON: cita i numeri (in euro, arrotondati) e da dove vengono. Se un dato non c'è, dillo e indica dove guardare nell'app (Movimenti, Preventivo, Analisi, Conti).
Non inventare cifre, nomi o norme. Per questioni fiscali o normative ricorda di verificare con il commercialista. Non hai accesso ai dati personali.`;
    const prompt = `Contesto (dati che l'utente può vedere):\n${JSON.stringify(ctx)}\n\n${history.map((h: { q: string; a: string }) => `Domanda precedente: ${h.q}\nRisposta: ${h.a}`).join('\n\n')}\n\nDomanda: ${q}`;
    try {
      answer = await callText({ apiKey, model: MAIN_MODEL(), system, prompt, maxTokens: 1200 });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }
  return NextResponse.json({ answer });
}
