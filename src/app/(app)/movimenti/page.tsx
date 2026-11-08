import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { date, money, nm } from '@/lib/format';
import { ErrorNote, PageHead, Panel } from '@/components/Page';
import { DocIndicator, EmptyState, Ico, KindIcon, StatusChip } from '@/components/Ui';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; ref: string | null; op_date: string; kind: 'income' | 'expense' | 'transfer';
  status: 'draft' | 'recorded' | 'verified'; description: string; amount: string; currency: string; sign: number;
  reverses_id: string | null; no_doc_reason: string | null; docs: { count: number }[]; reimb_status: 'due' | 'paid' | null; paid_by: string | null;
  account: { name_it: string; name_fr: string } | null; category: { code: string } | null;
  project: { name: string } | null;
};

export default async function Movements({ searchParams }: { searchParams: Promise<{ stato?: string }> }) {
  const { stato = '' } = await searchParams;
  const { supabase, t, lang } = await requireMe();
  let q = supabase
    .from('movements')
    .select(`id, ref, op_date, kind, status, description, amount, currency, sign, reverses_id, no_doc_reason, reimb_status, paid_by, docs:movement_documents(count),
             account:accounts!movements_account_id_fkey(name_it, name_fr), category:categories(code), project:projects(name)`)
    .order('op_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (['draft', 'recorded', 'verified'].includes(stato)) q = q.eq('status', stato);
  const { data, error } = await q.returns<Row[]>();
  const filters = [['', t('all')], ['draft', t('drafts')], ['recorded', t('st_recorded')], ['verified', t('verified')]];

  return (
    <div className="stack">
      <PageHead title={t('nav_movements')}>
        <a className="btn" href={`/api/v1/export/movimenti?anno=${new Date().getFullYear()}${stato ? `&stato=${stato}` : ''}`}><Ico name="download" />{t('exp_xlsx')}</a>
        <div className="seg">
          {filters.map(([v, l]) => (
            <Link key={v} href={v ? `/movimenti?stato=${v}` : '/movimenti'} aria-current={(stato === v) ? 'true' : undefined}>{l}</Link>
          ))}
        </div>
      </PageHead>
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {(data ?? []).length === 0 ? <EmptyState title={t('empty_mov')} text={t('empty_mov_t')} badge="plus"
            action={<Link className="btn primary" href="/nuovo"><Ico name="plus" />{t('nav_new_long').replace('+ ', '')}</Link>} /> : (
          <table className="t">
            <thead>
              <tr><th style={{ width: 36 }}><span className="sr-only">{t('type')}</span></th><th className="hm">{t('date')}</th><th className="hm">{t('ref')}</th><th>{t('description')}</th><th className="hm">{t('code')}</th>
                <th className="hm">{t('project')}</th><th className="hm">{t('account')}</th><th className="r">{t('amount')}</th><th className="hm" style={{ width: 32 }}><span className="sr-only">{t('f_doc')}</span></th><th className="hm">{t('status')}</th></tr>
            </thead>
            <tbody>
              {data!.map((m) => {
                const signed = Number(m.amount) * m.sign * (m.kind === 'income' ? 1 : -1);
                return (
                  <tr key={m.id}>
                    <td><KindIcon kind={m.kind} label={t(`k_${m.kind}`)} faded={Boolean(m.reverses_id)} /></td>
                    <td className="num hm">{date(m.op_date)}</td>
                    <td className="num muted hm nw">{m.ref ?? '–'}</td>
                    <td><Link className="rowlink" href={`/movimenti/${m.id}`}>{m.description || t(`k_${m.kind}`)}</Link>
                      {m.reverses_id && <> <span className="chip">{t('reversal')}</span></>}
                      {m.reimb_status === 'due' && <> <span className="chip warn">{t('reimb_due_chip')}{m.paid_by ? ` · ${m.paid_by}` : ''}</span></>}
                      <div className="so muted">{[date(m.op_date), m.ref, m.category?.code, m.project?.name, nm(lang, m.account)].filter(Boolean).join(' · ')}</div>
                      <div className="so"><StatusChip s={m.status} label={t(`st_${m.status}`)} /></div></td>
                    <td className="muted hm">{m.category?.code ?? '–'}</td>
                    <td className="hm">{m.project?.name ?? '–'}</td>
                    <td className="hm">{nm(lang, m.account)}</td>
                    <td className={`r num nw ${m.kind === 'income' ? 'amt-in' : m.kind === 'transfer' ? 'amt-tr' : ''}`}>
                      {m.kind === 'transfer' ? money(m.amount, m.currency, lang) : `${signed > 0 ? '+' : ''}${money(signed, m.currency, lang)}`}</td>
                    <td className="hm">{m.kind !== 'transfer' && <DocIndicator count={m.docs?.[0]?.count ?? 0} noDocReason={m.no_doc_reason}
                      labels={{ has: t('doc_has'), missing: t('doc_missing'), none: t('doc_none') }} />}</td>
                    <td className="hm"><StatusChip s={m.status} label={t(`st_${m.status}`)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

