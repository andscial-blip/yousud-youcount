import Link from 'next/link';
import { can, requireMe, RESP } from '@/lib/session';
import { date, money, nm } from '@/lib/format';
import { Denied, Empty, ErrorNote, PageHead, Panel } from '@/components/Page';
import { verifyMovement } from './actions';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; ref: string; op_date: string; kind: 'income' | 'expense' | 'transfer'; description: string;
  amount: string; currency: string; version: number; created_by: string; recorded_by: string | null;
  reverses_id: string | null; account: { name_it: string; name_fr: string } | null; category: { code: string } | null;
  project: { name: string } | null;
};

export default async function Verify({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, RESP)) return <Denied text={t('only_staff')} />;
  const [{ data, error }, { data: users }, { data: fourEyes }] = await Promise.all([
    supabase.from('movements')
      .select(`id, ref, op_date, kind, description, amount, currency, version, created_by, recorded_by, reverses_id,
               account:accounts!movements_account_id_fkey(name_it, name_fr), category:categories(code), project:projects(name)`)
      .eq('status', 'recorded').order('op_date').limit(300).returns<Row[]>(),
    supabase.rpc('user_directory'),
    supabase.from('settings').select('value').eq('key', 'four_eyes').maybeSingle(),
  ]);
  const name = new Map(((users ?? []) as { id: string; full_name: string }[]).map((u) => [u.id, u.full_name]));
  const strict = fourEyes?.value !== false;
  const mine = (r: Row) => strict && (r.created_by === me!.id || r.recorded_by === me!.id);

  return (
    <div className="stack">
      <PageHead title={t('nav_verify')} />
      <p className="muted" style={{ margin: 0 }}>{t('verify_intro')}</p>
      {ok !== undefined && <div className="note">{t('verify_done')} {ok}</div>}
      {err && <div className="note err">{err}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {(data ?? []).length === 0 ? <Empty text={t('none')} /> : (
          <table className="t">
            <thead><tr><th>{t('date')}</th><th>{t('ref')}</th><th>{t('description')}</th><th>{t('code')}</th>
              <th>{t('project')}</th><th>{t('account')}</th><th className="r">{t('amount')}</th><th>{t('entered_by')}</th><th /></tr></thead>
            <tbody>
              {data!.map((r) => (
                <tr key={r.id}>
                  <td className="num">{date(r.op_date)}</td>
                  <td className="num muted">{r.ref}</td>
                  <td><Link className="rowlink" href={`/movimenti/${r.id}`}>{r.description || t(`k_${r.kind}`)}</Link>{r.reverses_id && <> <span className="chip">{t('reversal')}</span></>}</td>
                  <td className="muted">{r.category?.code ?? '–'}</td>
                  <td>{r.project?.name ?? '–'}</td>
                  <td>{nm(lang, r.account)}</td>
                  <td className="r num">{money(r.amount, r.currency, lang)}</td>
                  <td>{name.get(r.created_by) ?? '–'}</td>
                  <td className="r">
                    {mine(r) ? <span className="chip">{t('verify_own')}</span> : (
                      <form action={verifyMovement}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="version" value={r.version} />
                        <button className="btn primary" type="submit" style={{ padding: '5px 10px' }}>{t('verify_btn')}</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
