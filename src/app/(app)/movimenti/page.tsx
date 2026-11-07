import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { date, money, nm } from '@/lib/format';
import { Empty, ErrorNote, PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; ref: string | null; op_date: string; kind: 'income' | 'expense' | 'transfer';
  status: 'draft' | 'recorded' | 'verified'; description: string; amount: string; currency: string; sign: number;
  reverses_id: string | null; account: { name_it: string; name_fr: string } | null; category: { code: string } | null;
  project: { name: string } | null;
};

export default async function Movements({ searchParams }: { searchParams: Promise<{ stato?: string }> }) {
  const { stato = '' } = await searchParams;
  const { supabase, t, lang } = await requireMe();
  let q = supabase
    .from('movements')
    .select(`id, ref, op_date, kind, status, description, amount, currency, sign, reverses_id,
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
        <div className="seg">
          {filters.map(([v, l]) => (
            <Link key={v} href={v ? `/movimenti?stato=${v}` : '/movimenti'} aria-pressed={stato === v}>{l}</Link>
          ))}
        </div>
      </PageHead>
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {(data ?? []).length === 0 ? <Empty text={t('none')} /> : (
          <table className="t">
            <thead>
              <tr><th>{t('date')}</th><th className="hm">{t('ref')}</th><th>{t('description')}</th><th className="hm">{t('code')}</th>
                <th className="hm">{t('project')}</th><th className="hm">{t('account')}</th><th className="r">{t('amount')}</th><th className="hm">{t('status')}</th></tr>
            </thead>
            <tbody>
              {data!.map((m) => {
                const signed = Number(m.amount) * m.sign * (m.kind === 'income' ? 1 : -1);
                return (
                  <tr key={m.id}>
                    <td className="num">{date(m.op_date)}</td>
                    <td className="num muted hm nw">{m.ref ?? '–'}</td>
                    <td><Link className="rowlink" href={`/movimenti/${m.id}`}>{m.description || t(`k_${m.kind}`)}</Link>
                      {m.reverses_id && <> <span className="chip">{t('reversal')}</span></>}
                      <div className="so muted">{[m.ref, m.category?.code, m.project?.name, nm(lang, m.account)].filter(Boolean).join(' · ')}</div>
                      <div className="so"><StatusChip s={m.status} label={t(`st_${m.status}`)} /></div></td>
                    <td className="muted hm">{m.category?.code ?? '–'}</td>
                    <td className="hm">{m.project?.name ?? '–'}</td>
                    <td className="hm">{nm(lang, m.account)}</td>
                    <td className="r num nw">{m.kind === 'transfer' ? money(m.amount, m.currency, lang) : money(signed, m.currency, lang)}</td>
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

function StatusChip({ s, label }: { s: Row['status']; label: string }) {
  return <span className={`chip ${s === 'verified' ? 'ok' : s === 'recorded' ? 'warn' : ''}`}>{label}</span>;
}
