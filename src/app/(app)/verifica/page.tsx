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
  const mine = (r: Row) => strict && (r.created_by === me!.id || r.recorded_by === me!.id);

  return (
    <div className="stack">
      <PageHead title={t('nav_verify')} />
      <p className="muted" style={{ margin: 0 }}>{t('verify_intro')}</p>
      {ok !== undefined && <div className="note ok" role="status"><Ico name="verified" />{t('verify_done')} {ok}</div>}
      {err && <div className="note err">{err}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {(data ?? []).length === 0 ? <EmptyState title={t('empty_verify')} text={t('empty_verify_t')} badge="check" /> : (
          <table className="t">
            <thead><tr><th style={{ width: 36 }}><span className="sr-only">{t('type')}</span></th><th className="hm">{t('date')}</th><th className="hm">{t('ref')}</th><th>{t('description')}</th><th className="hm">{t('code')}</th>
              <th className="hm">{t('project')}</th><th className="hm">{t('account')}</th><th className="r">{t('amount')}</th><th className="hm" style={{ width: 32 }}><span className="sr-only">{t('f_doc')}</span></th><th className="hm">{t('entered_by')}</th><th className="hm" /></tr></thead>
            <tbody>
              {data!.map((r) => {
                const action = mine(r) ? <span className="chip">{t('verify_own')}</span> : (
                  <form action={verifyMovement}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="version" value={r.version} />
                    <button className="btn primary" type="submit" style={{ padding: '5px 10px' }}><Ico name="check" />{t('verify_btn')}</button>
                  </form>
                );
                return (
                  <tr key={r.id}>
                    <td><KindIcon kind={r.kind} label={t(`k_${r.kind}`)} /></td>
                    <td className="num hm">{date(r.op_date)}</td>
                    <td className="num muted hm nw">{r.ref}</td>
                    <td><Link className="rowlink" href={`/movimenti/${r.id}`}>{r.description || t(`k_${r.kind}`)}</Link>{r.reverses_id && <> <span className="chip">{t('reversal')}</span></>}
                      {/* telefono: i dettagli sotto la descrizione e il pulsante a portata di dito */}
                      <div className="so muted">{[date(r.op_date), r.ref, r.category?.code, r.project?.name, nm(lang, r.account), name.get(r.created_by)].filter(Boolean).join(' · ')}</div>
                      <div className="so" style={{ marginTop: 6 }}>{action}</div></td>
                    <td className="muted hm">{r.category?.code ?? '–'}</td>
                    <td className="hm">{r.project?.name ?? '–'}</td>
                    <td className="hm">{nm(lang, r.account)}</td>
                    <td className="r num nw">{money(r.amount, r.currency, lang)}</td>
                    <td className="hm">{r.kind !== 'transfer' && <DocIndicator count={r.docs?.[0]?.count ?? 0} noDocReason={r.no_doc_reason}
                      labels={{ has: t('doc_has'), missing: t('doc_missing'), none: t('doc_none') }} />}</td>
                    <td className="hm">{name.get(r.created_by) ?? '–'}</td>
                    <td className="r hm">{action}</td>
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
