import Link from 'next/link';
import { can, requireMe, RESP } from '@/lib/session';
import { date, money, nm } from '@/lib/format';
import { Denied, ErrorNote, PageHead, Panel } from '@/components/Page';
import { DocIndicator, EmptyState, Ico, KindIcon } from '@/components/Ui';
import { verifyMovement } from './actions';
import { docLabel, docState } from '@/lib/doc-state';

export const dynamic = 'force-dynamic';

type Row = {
  id: string; ref: string; op_date: string; kind: 'income' | 'expense' | 'transfer'; description: string;
  amount: string; currency: string; amount_eur: string | null; sign: number; version: number; project_id: string | null; created_by: string; recorded_by: string | null;
  reverses_id: string | null; no_doc_reason: string | null; docs: { count: number }[]; account: { name_it: string; name_fr: string } | null; category: { code: string } | null;
  project: { name: string } | null;
};

export default async function Verify({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; progetto?: string; autore?: string }> }) {
  const { ok, err, progetto = '', autore = '' } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, RESP)) return <Denied text={t('only_staff')} />;
  const [{ data, error }, { data: users }, { data: fourEyes }] = await Promise.all([
    supabase.from('movements')
      .select(`id, ref, op_date, kind, description, amount, currency, amount_eur, sign, version, project_id, created_by, recorded_by, reverses_id, no_doc_reason, docs:movement_documents(count),
               account:accounts!movements_account_id_fkey(name_it, name_fr), category:categories(code), project:projects(name)`)
      .eq('status', 'recorded').order('op_date').limit(300).returns<Row[]>(),
    supabase.rpc('user_directory'),
    supabase.from('settings').select('value').eq('key', 'four_eyes').maybeSingle(),
  ]);
  const name = new Map(((users ?? []) as { id: string; full_name: string }[]).map((u) => [u.id, u.full_name]));
  const strict = fourEyes?.value !== false;
  const mine = (r: Row) => strict && me!.role !== 'super_admin' && (r.created_by === me!.id || r.recorded_by === me!.id);
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const all = data ?? [];
  // filtri per progetto e per autore, costruiti da ciò che è in coda
  const prjOpts = [...new Map(all.filter((r) => r.project_id).map((r) => [r.project_id!, r.project?.name ?? '–'])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const autOpts = [...new Set(all.map((r) => r.created_by))].map((id) => [id, name.get(id) ?? '–'] as const).sort((a, b) => a[1].localeCompare(b[1]));
  const rows = all.filter((r) => (!progetto || r.project_id === progetto) && (!autore || r.created_by === autore));
  // importo con il segno (uscita negativa, entrata positiva; lo storno inverte) e controvalore in euro
  const signed = (r: Row) => r.kind === 'transfer' ? Number(r.amount) : Number(r.amount) * (r.sign < 0 ? -1 : 1) * (r.kind === 'income' ? 1 : -1);
  const eq = (r: Row) => r.currency !== 'EUR' && r.amount_eur ? money(Number(r.amount_eur) * (signed(r) < 0 ? -1 : 1), 'EUR', lang) : null;
  const dstate = (r: Row) => r.kind === 'transfer' ? null : docState(r.docs?.[0]?.count, r.no_doc_reason);

  return (
    <div className="stack">
      <PageHead title={`${t('nav_verify')} (${all.length})`} />
      <p className="muted vf-count">{all.length === 0 ? '' : L(`${all.length} movimenti registrati in attesa di verifica${rows.length !== all.length ? ` · ${rows.length} con i filtri scelti` : ''}.`, `${all.length} mouvements comptabilisés en attente de vérification${rows.length !== all.length ? ` · ${rows.length} avec les filtres choisis` : ''}.`)}</p>
      {all.length > 0 && (prjOpts.length > 1 || autOpts.length > 1) && (
        <form className="vf-filter" method="get" action="/verifica">
          <label className="field"><span className="flabel">{t('project')}</span>
            <select className="input" name="progetto" defaultValue={progetto}><option value="">{t('all')}</option>{prjOpts.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
          <label className="field"><span className="flabel">{L('Inserito da', 'Saisi par')}</span>
            <select className="input" name="autore" defaultValue={autore}><option value="">{t('all')}</option>{autOpts.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
          <button className="btn" type="submit">{L('Filtra', 'Filtrer')}</button>
          {(progetto || autore) && <Link className="btn ghost" href="/verifica">{L('Tutti', 'Tous')} ({all.length})</Link>}
        </form>
      )}
      {ok !== undefined && <div className="note ok" role="status"><Ico name="verified" />{t('verify_done')} {ok}</div>}
      {err && <div className="note err">{err}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {rows.length === 0 ? <EmptyState title={t('empty_verify')} text={t('empty_verify_t')} badge="check" /> : (<>
          <table className="t keep vf-table">
            <thead><tr><th style={{ width: 36 }}><span className="sr-only">{t('type')}</span></th><th>{t('date')}</th><th>{t('description')}</th>
              <th>{t('project')} · {t('account')}</th><th className="r">{t('amount')}</th><th style={{ width: 32 }}><span className="sr-only">{t('f_doc')}</span></th><th /></tr></thead>
            <tbody>
              {rows.map((r) => {
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
                    <td className="r num nw">{eq(r) ?? money(signed(r), r.currency, lang)}{eq(r) && <div className="muted small">{money(signed(r), r.currency, lang)}</div>}</td>
                    <td>{r.kind !== 'transfer' && <DocIndicator count={r.docs?.[0]?.count ?? 0} noDocReason={r.no_doc_reason}
                      labels={{ has: t('doc_has'), missing: t('doc_missing'), none: t('doc_none') }} />}</td>
                    <td className="r">{action}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ul className="mv-cards vf-cards">
            {rows.map((r) => { const ds = dstate(r); return (
              <li key={r.id}><div className="vf-c">
                <KindIcon kind={r.kind} label={t(`k_${r.kind}`)} />
                <div className="mc-m"><Link className="mc-t" href={`/movimenti/${r.id}`}>{r.description || t(`k_${r.kind}`)}</Link>
                  <span className="mc-s">{[date(r.op_date), r.ref, r.project?.name, name.get(r.created_by)].filter(Boolean).join(' · ')}</span>
                  <span className="mc-c">{ds && <span className={`chip tiny vf-doc ${ds}`}>{docLabel(ds, lang)}</span>}
                    {r.reverses_id && <span className="chip tiny">{t('reversal')}</span>}</span></div>
                <span className={`mc-a two num ${r.kind === 'income' ? 'amt-in' : ''}`}><b>{eq(r) ?? money(signed(r), r.currency, lang)}</b>{eq(r) && <small>{money(signed(r), r.currency, lang)}</small>}</span>
                <div className="vf-act">
                  <Link className="btn small" href={`/movimenti/${r.id}`}>{ds === 'doc' ? L('Apri e controlla il documento', 'Ouvrir et contrôler la pièce') : L('Apri', 'Ouvrir')}</Link>
                  {mine(r) ? <span className="chip tiny">{t('verify_own')}</span> : (
                    <form action={verifyMovement}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="version" value={r.version} />
                      <button className="btn primary small" type="submit"><Ico name="check" />{t('verify_btn')}</button></form>)}</div>
              </div></li>); })}
          </ul></>
        )}
      </Panel>
    </div>
  );
}
