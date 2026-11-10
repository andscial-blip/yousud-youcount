import Link from 'next/link';
import { can, requireMe, RESP } from '@/lib/session';
import { date, money, nm } from '@/lib/format';
import { Denied, ErrorNote, PageHead, Panel } from '@/components/Page';
import { DocIndicator, EmptyState, Ico, KindIcon } from '@/components/Ui';
import { verifyMovement } from './actions';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; ref: string; op_date: string; kind: 'income' | 'expense' | 'transfer'; description: string;
  amount: string; currency: string; version: number; created_by: string; recorded_by: string | null;
  reverses_id: string | null; no_doc_reason: string | null; docs: { count: number }[]; account: { name_it: string; name_fr: string } | null; category: { code: string } | null;
  project: { name: string } | null;
};

export default async function Verify({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, RESP)) return <Denied text={t('only_staff')} />;
  const [{ data, error }, { data: users }, { data: fourEyes }] = await Promise.all([
    supabase.from('movements')
      .select(`id, ref, op_date, kind, description, amount, currency, version, created_by, recorded_by, reverses_id, no_doc_reason, docs:movement_documents(count),
               account:accounts!movements_account_id_fkey(name_it, name_fr), category:categories(code), project:projects(name)`)
      .eq('status', 'recorded').order('op_date').limit(300).returns<Row[]>(),
    supabase.rpc('user_directory'),
    supabase.from('settings').select('value').eq('key', 'four_eyes').maybeSingle(),
  ]);
  const name = new Map(((users ?? []) as { id: string; full_name: string }[]).map((u) => [u.id, u.full_name]));
  const strict = fourEyes?.value !== false;
  const mine = (r: Row) => strict && me!.role !== 'super_admin' && (r.created_by === me!.id || r.recorded_by === me!.id);

  return (
    <div className="stack">
      <PageHead title={t('nav_verify')} />
      {ok !== undefined && <div className="note ok" role="status"><Ico name="verified" />{t('verify_done')} {ok}</div>}
      {err && <div className="note err">{err}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {(data ?? []).length === 0 ? <EmptyState title={t('empty_verify')} text={t('empty_verify_t')} badge="check" /> : (<>
          <table className="t keep vf-table">
            <thead><tr><th style={{ width: 36 }}><span className="sr-only">{t('type')}</span></th><th>{t('date')}</th><th>{t('description')}</th>
              <th>{t('project')} · {t('account')}</th><th className="r">{t('amount')}</th><th style={{ width: 32 }}><span className="sr-only">{t('f_doc')}</span></th><th /></tr></thead>
            <tbody>
              {data!.map((r) => {
                const action = mine(r) ? <span className="chip">{t('verify_own')}</span> : (
                  <form action={verifyMovement}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="version" value={r.version} />
                    <button className="btn primary small" type="submit"><Ico name="check" />{t('verify_btn')}</button>
                  </form>
                );
                return (
                  <tr key={r.id}>
                    <td><KindIcon kind={r.kind} label={t(`k_${r.kind}`)} /></td>
                    <td className="num nw">{date(r.op_date)}<div className="muted small">{r.ref}</div></td>
                    <td><Link className="rowlink" href={`/movimenti/${r.id}`}>{r.description || t(`k_${r.kind}`)}</Link>{r.reverses_id && <> <span className="chip tiny">{t('reversal')}</span></>}
                      <div className="muted small">{[r.category?.code, name.get(r.created_by)].filter(Boolean).join(' · ')}</div></td>
                    <td>{r.project?.name ?? '–'}<div className="muted small">{nm(lang, r.account)}</div></td>
                    <td className="r num nw">{money(r.amount, r.currency, lang)}</td>
                    <td>{r.kind !== 'transfer' && <DocIndicator count={r.docs?.[0]?.count ?? 0} noDocReason={r.no_doc_reason}
                      labels={{ has: t('doc_has'), missing: t('doc_missing'), none: t('doc_none') }} />}</td>
                    <td className="r">{action}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ul className="mv-cards vf-cards">
            {data!.map((r) => (
              <li key={r.id}><div className="vf-c">
                <KindIcon kind={r.kind} label={t(`k_${r.kind}`)} />
                <div className="mc-m"><Link className="mc-t" href={`/movimenti/${r.id}`}>{r.description || t(`k_${r.kind}`)}</Link>
                  <span className="mc-s">{[date(r.op_date), r.ref, r.project?.name, name.get(r.created_by)].filter(Boolean).join(' · ')}</span>
                  {mine(r) ? <span className="chip tiny" style={{ marginLeft: 0 }}>{t('verify_own')}</span> : (
                    <form action={verifyMovement}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="version" value={r.version} />
                      <button className="btn primary small" type="submit"><Ico name="check" />{t('verify_btn')}</button></form>)}</div>
                <span className="mc-a num"><b>{money(r.amount, r.currency, lang)}</b></span>
              </div></li>))}
          </ul></>
        )}
      </Panel>
    </div>
  );
}
