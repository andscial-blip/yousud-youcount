import { docName } from '@/lib/doc-name';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { requireMe, RESP } from '@/lib/session';
import { date, dateTime, money, nm } from '@/lib/format';
import type { Key } from '@/lib/i18n';
import { Panel } from '@/components/Page';
import { Ico, KindIcon, StatusChip } from '@/components/Ui';
import { discardAction, reverseAction, verifyAction } from './actions';

export const dynamic = 'force-dynamic';

type N = { name_it: string; name_fr: string } | null;
type M = {
  id: string; ref: string | null; kind: 'income' | 'expense' | 'transfer'; status: 'draft' | 'recorded' | 'verified';
  op_date: string; doc_date: string | null; description: string; amount: string; currency: string; fx_rate: string | null;
  amount_eur: string | null; to_amount: string | null; notes: string | null; no_doc_reason: string | null;
  reverses_id: string | null; reversal_reason: string | null; version: number; ai_extracted: boolean;
  created_by: string; created_at: string; recorded_by: string | null; recorded_at: string | null;
  verified_by: string | null; verified_at: string | null;
  paid_by: string | null; reimb_status: 'due' | 'paid' | null; reimbursed_at: string | null; reimbursed_by: string | null;
  account: N; to_account: (N & { currency: string }) | null; category: (N & { code: string }) | null;
  project: { name: string } | null; grant: { id: string; title: string } | null; counterparty: { name: string } | null; method: N;
};
type H = { at: string; action: string; actor: string | null; old_row: Record<string, unknown> | null; new_row: Record<string, unknown> | null };
const SKIP = new Set(['updated_at', 'updated_by', 'version', 'last_op_uuid', 'recorded_by', 'recorded_at', 'ref', 'amount_eur', 'sign']);
// campi modificati nello storico, con l'etichetta che l'utente vede nel modulo
const FIELD: Record<string, Key> = {
  amount: 'amount', description: 'description', op_date: 'f_op_date', doc_date: 'f_doc_date', account_id: 'account',
  to_account_id: 'f_to_account', to_amount: 'f_to_account', category_id: 'f_category', project_id: 'project', grant_id: 'nav_grants',
  counterparty_id: 'f_counterparty', payment_method_id: 'f_method', notes: 'f_notes', status: 'status', currency: 'currency',
  fx_rate: 'f_rate', paid_by: 'f_paid_by', no_doc_reason: 'd_no_reason', kind: 'f_kind', reimb_status: 'nav_reimb',
};

export default async function MovementDetail({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { id } = await params;
  const { ok, err } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  const { data: m } = await supabase.from('movements').select(`*,
      account:accounts!movements_account_id_fkey(name_it, name_fr),
      to_account:accounts!movements_to_account_id_fkey(name_it, name_fr, currency),
      category:categories(code, name_it, name_fr), project:projects(name), grant:grants(id, title), counterparty:counterparties(name),
      method:payment_methods(name_it, name_fr)`).eq('id', id).maybeSingle<M>();
  if (!m) notFound();
  const [{ data: links }, { data: hist }, { data: users }, { data: rev }, { data: fe }, { data: recs }] = await Promise.all([
    supabase.from('movement_documents').select('seq, document:documents(id, doc_type, original_path, pdf_path, mime, file_name, created_at)').eq('movement_id', id).order('seq'),
    supabase.rpc('movement_history', { p_id: id }),
    supabase.rpc('user_directory'),
    supabase.from('movements').select('id, ref').eq('reverses_id', id).maybeSingle(),
    supabase.from('settings').select('value').eq('key', 'four_eyes').maybeSingle(),
    // spunte nella riconciliazione bancaria (spiegano perché importo, conto e data non si modificano più)
    supabase.from('reconciliation_items').select('side, rec:bank_reconciliations(statement_date, account_id)').eq('movement_id', id),
  ]);
  const recDates = ((recs ?? []) as unknown as { side: string; rec: { statement_date: string } | null }[])
    .map((r) => r.rec?.statement_date).filter(Boolean) as string[];
  const name = new Map(((users ?? []) as { id: string; full_name: string }[]).map((u) => [u.id, u.full_name]));
  type D = { id: string; original_path: string; pdf_path: string | null; mime: string; file_name: string | null; created_at: string };
  const docs = ((links ?? []) as unknown as { seq: number; document: D | null }[])
    .filter((l) => l.document)
    .map((l) => {
      const path = l.document!.pdf_path ?? l.document!.original_path;
      return { ...l.document!, path, name: docName(m.ref, l.seq, path, l.document!.file_name) };
    });
  const bucket = supabase.storage.from('documents');
  const signed = await Promise.all(docs.map(async (d) => ({
    open: (await bucket.createSignedUrl(d.path, 600)).data?.signedUrl,
    save: (await bucket.createSignedUrl(d.path, 600, { download: d.name })).data?.signedUrl,
  })));
  const resp = me && RESP.includes(me.role);
  const strict = fe?.value !== false;
  const canVerify = resp && m.status === 'recorded' && !rev && !(strict && (m.created_by === me!.id || m.recorded_by === me!.id));
  const canReverse = resp && m.status !== 'draft' && !m.reverses_id && !rev;
  const canEdit = !rev && (m.status === 'draft' ? (m.created_by === me!.id || resp) : m.status === 'recorded' && resp);
  const signedAmount = m.kind === 'transfer' ? Number(m.amount) : Number(m.amount) * (m.reverses_id ? -1 : 1) * (m.kind === 'income' ? 1 : -1);
  const errText = err ? (t(`err_${err.split(':')[0]}` as Key) ?? err) : null;

  const row = (label: string, value: React.ReactNode) => (<><dt>{label}</dt><dd>{value ?? '–'}</dd></>);
  return (
    <div className="stack">
      <Link href="/movimenti" className="muted" style={{ textDecoration: 'none' }}>{t('d_back')}</Link>
      <div className="h1row">
        <KindIcon kind={m.kind} label={t(`k_${m.kind}`)} />
        <h1>{m.ref ?? t('st_draft')} · {t(`k_${m.kind}`)}</h1>
        <StatusChip s={m.status} label={t(`st_${m.status}`)} />
        {rev && <Link className="chip ichip err" href={`/movimenti/${rev.id}`}><Ico name="reversed" size={14} />{t('d_reversed_by')} {rev.ref}</Link>}
      </div>
      {ok && <div className="note ok" role="status"><Ico name="verified" />{ok === 'verified' ? t('verify_done') : ok === 'reversed' ? t('d_reverses') : ''}</div>}
      {errText && <div className="note err">{errText}</div>}

      <div className="detail">
        <div className="detail-main stack">
          <section className="panel mv-sum">
            <div className="mv-amt">
              <span className="l">{t('amount')}</span>
              <span className={`v num ${signedAmount < 0 ? '' : m.kind === 'income' ? 'pos' : ''}`}>{money(signedAmount, m.currency, lang)}</span>
              {m.currency === 'MGA' && m.amount_eur && <span className="s num">{money(m.amount_eur, 'EUR', lang)} · {t('f_rate')} {money(m.fx_rate, 'MGA', lang).replace(/\s?MGA$/, '')}</span>}
            </div>
            <div className="panel-b">
              <dl className="kv">
                {row(t('f_op_date'), date(m.op_date))}
                {row(t('description'), m.description || null)}
                {m.reimb_status === 'due' ? row(t('account'), <span className="chip warn">{t('reimb_due_chip')}</span>)
                : row(m.kind === 'transfer' ? t('f_from_account') : t('account'), nm(lang, m.account))}
                {m.paid_by && row(t('f_paid_by'), m.paid_by)}
                {m.reimb_status === 'paid' && m.reimbursed_at && row(t('reimb_done_row'), `${date(m.op_date)} · ${name.get(m.reimbursed_by ?? '') ?? '–'}`)}
                {m.kind === 'transfer' && row(t('f_to_account'), `${nm(lang, m.to_account)} · ${money(m.to_amount, m.to_account?.currency ?? m.currency, lang)}`)}
                {m.category && row(t('f_category'), `${m.category.code} · ${nm(lang, m.category)}`)}
                {m.kind !== 'transfer' && row(t('project'), m.project?.name)}
                {m.grant && row(t('nav_grants'), <Link href={`/finanziamenti/${m.grant.id}`}>{m.grant.title}</Link>)}
                {m.counterparty && row(t('f_counterparty'), m.counterparty.name)}
                {m.method && row(t('f_method'), nm(lang, m.method))}
                {m.doc_date && row(t('f_doc_date'), date(m.doc_date))}
                {m.notes && row(t('f_notes'), m.notes)}
                {m.reverses_id && row(t('d_reverses'), <><Link href={`/movimenti/${m.reverses_id}`}>{t('d_open')}</Link> · {m.reversal_reason}</>)}
                {recDates.length > 0 && row(t('rec_chip'), <span className="chip ok">{t('rec_in_statement')} {recDates.map((d) => date(d)).join(', ')}</span>)}
                {row(t('d_created'), `${dateTime(m.created_at, lang)} · ${name.get(m.created_by) ?? '–'}`)}
                {m.recorded_at && row(t('d_recorded'), `${dateTime(m.recorded_at, lang)} · ${name.get(m.recorded_by ?? '') ?? '–'}`)}
                {m.verified_at && row(t('d_verified'), `${dateTime(m.verified_at, lang)} · ${name.get(m.verified_by ?? '') ?? '–'}`)}
              </dl>
            </div>
          </section>
          {(canEdit || canVerify || canReverse || m.status === 'draft') && (
            <div className="factions">
              {canEdit && <Link className="btn" href={`/movimenti/${m.id}/modifica`}>{t('d_edit')}</Link>}
              {canVerify && (
                <form action={verifyAction}>
                  <input type="hidden" name="id" value={m.id} /><input type="hidden" name="version" value={m.version} />
                  <button className="btn primary" type="submit"><Ico name="check" />{t('verify_btn')}</button>
                </form>
              )}
              {m.status === 'draft' && canEdit && (
                <form action={discardAction}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="btn ghost" type="submit" style={{ color: 'var(--red)' }}>{t('d_discard')}</button>
                </form>
              )}
            </div>
          )}
        </div>
        <aside className="detail-side stack">
          {(m.kind !== 'transfer' || docs.length > 0) && (
            <Panel title={t('d_documents')} pad>
              {docs.length === 0 ? <p className="muted" style={{ margin: 0 }}>{m.no_doc_reason ? `${t('d_no_reason')}: ${m.no_doc_reason}` : t('none')}</p> : (
                <ul className="docs">
                  {docs.map((d, i) => (
                    <li key={d.id}><span className="num">{d.name}</span>
                      {signed[i]?.open ? <a className="btn" href={signed[i].open} target="_blank" rel="noreferrer">{t('d_open')}</a> : null}
                      {signed[i]?.save ? <a className="btn ghost" href={signed[i].save} title={d.name}><Ico name="download" />{t('d_download')}</a> : null}</li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {canReverse && (
            <details className="panel">
              <summary className="panel-h" style={{ cursor: 'pointer' }}><h2>{t('d_reverse')}</h2></summary>
              <form action={reverseAction} className="panel-b stack" style={{ gap: 10 }}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="client_uuid" value={randomUUID()} />
                <div className="field">
                  <label htmlFor="reason">{t('d_reverse_reason')}</label>
                  <input className="input" id="reason" name="reason" required minLength={5} maxLength={300} />
                </div>
                <div><button className="btn primary" type="submit">{t('d_reverse_btn')}</button></div>
              </form>
            </details>
          )}

          <Panel title={t('d_history')}>
            <table className="t">
              <tbody>
                {((hist ?? []) as H[]).map((h, i) => {
                  const changed = h.action === 'update' && h.old_row && h.new_row
                    ? Object.keys(h.new_row).filter((k) => !SKIP.has(k) && JSON.stringify(h.new_row![k]) !== JSON.stringify(h.old_row![k]))
                    : [];
                  return (
                    <tr key={i}>
                      <td className="num nw">{dateTime(h.at, lang)}</td>
                      <td>{h.actor ? name.get(h.actor) ?? '–' : '–'}</td>
                      <td>{t(`a_${h.action}` as Key)}{changed.length > 0 && <span className="muted"> · {[...new Set(changed.map((k) => (FIELD[k] ? t(FIELD[k]) : k)))].join(', ')}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
