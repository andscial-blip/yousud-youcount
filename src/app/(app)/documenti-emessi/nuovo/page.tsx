import { STAFF, can, requireMe } from '@/lib/session';
import { DOC_TYPES, type DocType } from '@/lib/doc-model';
import { DocForm, type DocInit } from '@/components/DocForm';
import { PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

// Nuovo documento: precompilato dal movimento quando si arriva dal dettaglio (?mov=…).
export default async function NewDoc({ searchParams }: { searchParams: Promise<{ tipo?: string; mov?: string; err?: string }> }) {
  const sp = await searchParams;
  const { supabase, me, lang } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const type = (Object.keys(DOC_TYPES).includes(sp.tipo ?? '') ? sp.tipo : 'RIC') as Exclude<DocType, 'AUT'>;
  const [{ data: projects }, { data: pms }, mv] = await Promise.all([
    supabase.from('projects').select('id, name').eq('active', true).order('name'),
    supabase.from('payment_methods').select('name_it, name_fr').order('sort'),
    /^[0-9a-f-]{36}$/.test(sp.mov ?? '') ? supabase.from('movements')
      .select('id, op_date, amount, currency, description, project_id, counterparty_id, paid_by, counterparty:counterparties(name), method:payment_methods(name_it, name_fr)')
      .eq('id', sp.mov!).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  type Mv = { id: string; op_date: string; amount: string; currency: string; description: string | null; project_id: string | null; counterparty_id: string | null;
    paid_by: string | null; counterparty: { name: string } | null; method: { name_it: string; name_fr: string | null } | null };
  const m = mv.data as unknown as Mv | null;
  const priv = m?.counterparty_id && can(me, STAFF)
    ? (await supabase.from('counterparty_private').select('tax_code, address').eq('counterparty_id', m.counterparty_id).maybeSingle()).data : null;
  const method = m?.method ? (lang === 'fr' && m.method.name_fr ? m.method.name_fr : m.method.name_it) : '';
  const init: DocInit = {
    type, lang: lang === 'fr' ? 'fr' : 'it', doc_date: new Date().toISOString().slice(0, 10), currency: m?.currency ?? 'EUR',
    movement_id: m?.id ?? null, project_id: m?.project_id ?? null, counterparty_id: m?.counterparty_id ?? null,
    party_name: m ? (type === 'NRS' || type === 'ASP' ? m.paid_by ?? m.counterparty?.name ?? '' : m.counterparty?.name ?? m.paid_by ?? '') : '',
    party_tax_id: priv?.tax_code ?? '', party_address: priv?.address ?? '', amount: m ? Number(m.amount) : '',
    data: m ? { method, desc: m.description ?? '', causale_txt: type === 'RIC' ? m.description ?? '' : undefined, received_on: m.op_date, paid_on: m.op_date,
      lines: type === 'NOT' ? [{ d: m.description ?? '', q: 1, p: Number(m.amount) }] : type === 'NRS' ? [{ date: m.op_date, d: m.description ?? '', amt: Number(m.amount), doc: true }] : undefined,
      deduc: true } : { deduc: true },
  };
  return (
    <div className="stack">
      <PageHead title={L(DOC_TYPES[type].it, DOC_TYPES[type].fr)} />
      {sp.err && <div className="note err">{sp.err}</div>}
      <Panel pad>
        <DocForm init={init} lang={lang} projects={projects ?? []} methods={(pms ?? []).map((p) => (lang === 'fr' && p.name_fr ? p.name_fr : p.name_it))}
                 back={m ? `/movimenti/${m.id}` : '/documenti-emessi'} />
      </Panel>
    </div>
  );
}
