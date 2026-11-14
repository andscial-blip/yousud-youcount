import { docName } from '@/lib/doc-name';
import { can, requireMe } from '@/lib/session';
import { dictFor } from '@/lib/i18n';
import { loadRefData } from '@/lib/movement-ref';
import { Denied, PageHead } from '@/components/Page';
import { MovementForm, type Prefill } from '@/components/MovementForm';

export const dynamic = 'force-dynamic';

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

// ?tipo=expense|income&data=AAAA-MM-GG&importo=12.5&conto=<id>&desc=… (da una riga dell'estratto conto)
export default async function NewMovement({ searchParams }: { searchParams: SP }) {
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ['super_admin', 'admin', 'responsabile', 'operator'])) return <Denied text={t('err_forbidden')} />;
  const refData = await loadRefData(supabase, me!, lang);
  const sp = await searchParams;
  const kind = one(sp.tipo);
  const date = one(sp.data);
  const amount = Number(one(sp.importo));
  const account = one(sp.conto);
  const prefill: Prefill = {
    kind: kind === 'income' || kind === 'expense' ? kind : undefined,
    op_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : undefined,
    account_id: refData.accounts.some((a) => a.id === account) ? account : undefined,
    description: one(sp.desc).slice(0, 300) || undefined,
    own: one(sp.tasca) === '1' ? true : undefined,
    // progetto già scelto (da «+ Ricevuta» di una richiesta di anticipo)
    project_id: refData.projects.some((x) => x.id === one(sp.progetto)) ? one(sp.progetto) : undefined,
  };
  // ?copia=<id>: «Crea la copia corretta» dopo uno storno. Si ripartono dati e allegati dell'originale, da correggere prima di registrare.
  const copyId = one(sp.copia);
  let copyRef: string | null = null;
  if (/^[0-9a-f-]{36}$/.test(copyId)) {
    const { data: o } = await supabase.from('movements')
      .select(`ref, kind, op_date, description, amount, account_id, category_id, project_id, grant_id, counterparty_id, payment_method_id, notes,
               links:movement_documents(seq, document:documents(id, original_path, pdf_path, file_name))`)
      .eq('id', copyId).maybeSingle();
    if (o && (o.kind === 'income' || o.kind === 'expense')) {
      type Lk = { seq: number; document: { id: string; original_path: string; pdf_path: string | null; file_name: string | null } | null };
      const links = ((o.links ?? []) as unknown as Lk[]).filter((l) => l.document).sort((a, b) => a.seq - b.seq);
      copyRef = o.ref as string | null;
      Object.assign(prefill, {
        kind: o.kind, op_date: o.op_date, amount: Number(o.amount), description: o.description ?? undefined,
        account_id: refData.accounts.some((a) => a.id === o.account_id) ? o.account_id : undefined,
        project_id: o.project_id ?? undefined, category_id: o.category_id ?? undefined, grant_id: o.grant_id ?? undefined,
        counterparty_id: o.counterparty_id ?? undefined, payment_method_id: o.payment_method_id ?? undefined, notes: o.notes ?? undefined,
        docs: links.map((l) => ({ id: l.document!.id, label: docName(o.ref as string | null, l.seq, l.document!.pdf_path ?? l.document!.original_path, l.document!.file_name) })),
      } satisfies Prefill);
    }
  }
  const has = Object.entries(prefill).some(([k, v]) => k !== 'own' && v !== undefined);
  return (
    <div className="stack">
      <PageHead title={t('f_new_title')} />
      {/* l'avviso «dati presi dall'estratto conto» solo quando è vero: importo o descrizione arrivano da una riga dell'estratto */}
      {copyRef
        ? <div className="note info">{lang === 'fr' ? `Copie de ${copyRef} : données et pièces jointes reprises de l’original. Corrigez ce qui était erroné, puis comptabilisez.` : `Copia di ${copyRef}: dati e allegati ripresi dall’originale. Correggi ciò che era sbagliato, poi registra.`}</div>
        : (prefill.amount !== undefined || prefill.description !== undefined) && <div className="note info">{t('f_prefill_stmt')}</div>}
      <MovementForm refData={refData} t={dictFor(lang)} prefill={has || prefill.own ? prefill : undefined} />
    </div>
  );
}
