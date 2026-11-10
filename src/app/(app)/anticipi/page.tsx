import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { RESP, STAFF, can, requireMe } from '@/lib/session';
import { date, money, num } from '@/lib/format';
import type { Key } from '@/lib/i18n';
import { Denied, Empty, ErrorNote, PageHead, Panel, H2 } from '@/components/Page';
import { advanceStep, createAdvanceAccount, deliverAdvance, moveAdvance, requestAdvance } from './actions';

export const dynamic = 'force-dynamic';

type S = { account_id: string; code: string; name_it: string; name_fr: string; holder: string; currency: string; active: boolean;
  given: string; spent: string; returned: string; balance: string; open_since: string | null; last_move: string | null;
  spent_count: number; spent_no_doc: number; aut_to_sign: number; unverified: number };

const LATE_DAYS = 30;   // come il Gestionale: avviso dopo 30 giorni con saldo da giustificare

// Anticipi al personale: per persona consegnato, speso, restituito e saldo da giustificare.
type Req = { id: string; account_id: string; beneficiary_id: string | null; role_kind: string; amount: string; currency: string; amount_eur: string | null;
  purpose: string; project_id: string | null; use_date: string; report_by: string; status: string; requested_by: string; requested_at: string;
  authorized_by: string | null; authorized_amount: string | null; board_ref: string | null; decision_note: string | null; delivered_at: string | null;
  reported_at: string | null; closed_at: string | null };
const OPEN = ['requested', 'authorized', 'delivered', 'reported'];

export default async function Advances({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; chiusi?: string }> }) {
  const { ok, err, chiusi } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  if (!me) return <Denied text={t('only_staff')} />;
  const staff = can(me, STAFF), resp = can(me, RESP), writer = me.role !== 'read_only';
  const FR = lang === 'fr', LL = (it: string, fr: string) => (FR ? fr : it);
  const [{ data, error }, { data: cash }, { data: reqRaw }, { data: advAcc }, { data: people }, { data: prj }, { data: lim }] = await Promise.all([
    staff ? supabase.rpc('advance_summary') : Promise.resolve({ data: [], error: null }),
    supabase.from('accounts').select('id, name_it, name_fr, currency').eq('active', true).neq('kind', 'advance').order('sort'),
    supabase.from('advance_requests').select('*').order('requested_at', { ascending: false }).limit(300).returns<Req[]>(),
    supabase.from('accounts').select('id, holder, currency').eq('kind', 'advance').eq('active', true).order('holder'),
    supabase.from('profiles').select('id, full_name').eq('active', true).order('full_name'),
    supabase.from('projects').select('id, name').eq('active', true).order('name'),
    supabase.from('settings').select('value').eq('key', 'adv_limits').maybeSingle(),
  ]);
  const rows = (data ?? []) as S[];
  const today = new Date().toISOString().slice(0, 10);
  const days = (d: string | null) => (d ? Math.floor((Date.parse(today) - Date.parse(d)) / 864e5) : 0);
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + Number(r.balance));
  const L = (o: { name_it: string; name_fr: string | null }) => (lang === 'fr' && o.name_fr ? o.name_fr : o.name_it);
  const errText = err ? (() => { const k = `err_${err.split(':')[0]}` as Key; const v = t(k); return v && v !== k ? v : err; })() : null;
  const active = rows.filter((r) => r.active);
  const reqs = reqRaw ?? [];
  const accBy = new Map((advAcc ?? []).map((a) => [a.id, a]));
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name as string]));
  const prjBy = new Map((prj ?? []).map((p) => [p.id, p.name as string]));
  const limits = (lim?.value ?? {}) as { resp?: number; admin?: number; ref?: string | null };
  const shown = reqs.filter((r) => (chiusi ? true : OPEN.includes(r.status)));
  const cnt = (st: string) => reqs.filter((r) => r.status === st).length;
  const STEP: Record<string, [string, string, string]> = {
    requested: ['s1', 'Richiesta', 'Demande'], authorized: ['s2', 'Autorizzata', 'Autorisée'], delivered: ['s3', 'Consegnata', 'Remise'],
    reported: ['s4', 'In verifica', 'En vérification'], closed: ['s5', 'Chiusa', 'Clôturée'], rejected: ['sx', 'Respinta', 'Refusée'], cancelled: ['sx', 'Annullata', 'Annulée'] };
  const ERR: Record<string, [string, string]> = {
    four_eyes: ['Chi autorizza, consegna o chiude non può essere chi ha chiesto o chi riceve l’anticipo.', 'Qui autorise, remet ou clôture ne peut pas être qui a demandé ou qui reçoit l’avance.'],
    over_limit: ['Importo oltre la soglia del responsabile: serve un amministratore.', 'Montant au-delà du seuil du responsable : il faut un administrateur.'],
    board_needed: ['Importo oltre la soglia dell’amministratore: indica gli estremi della delibera del Consiglio.', 'Montant au-delà du seuil de l’administrateur : indiquez la délibération du Conseil.'],
    advance_overdue: ['Questa persona ha un anticipo da giustificare oltre la scadenza: prima va chiuso.', 'Cette personne a une avance à justifier en retard : il faut d’abord la clôturer.'],
    invalid_state: ['La richiesta è già passata a un altro stato: ricarica la pagina.', 'La demande a déjà changé d’état : rechargez la page.'] };
  const errKey = err?.split(':')[0] ?? '';
  const today2 = new Date().toISOString().slice(0, 10);
  const plus = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

  return (
    <div className="stack">
      <PageHead title={t('nav_advances')}>
        {writer && (advAcc ?? []).length > 0 && <a className="btn primary" href="#nuova-richiesta">+ {LL('Richiedi anticipo', 'Demander une avance')}</a>}
      </PageHead>
      {ok && <div className="note ok" role="status">{ok === 'req' ? LL('Richiesta registrata: ora la deve autorizzare un responsabile o un amministratore.', 'Demande enregistrée : un responsable ou un administrateur doit l’autoriser.')
        : ok === 'authorize' ? LL('Anticipo autorizzato.', 'Avance autorisée.') : ok === 'reject' ? LL('Richiesta respinta.', 'Demande refusée.')
        : ok === 'deliver' ? LL('Consegna registrata: giroconto dalla cassa al conto anticipi della persona.', 'Remise enregistrée : virement de la caisse au compte d’avances.')
        : ok === 'report' ? LL('Rendiconto segnato: ora lo controlla un responsabile.', 'Rapport signalé : un responsable va le contrôler.')
        : ok === 'close' ? LL('Anticipo chiuso.', 'Avance clôturée.') : ok === 'cancel' ? LL('Richiesta annullata.', 'Demande annulée.') : t('adv_saved')}</div>}
      {errText && <div className="note err">{err === 'no_rate' ? t('adv_no_rate') : ERR[errKey] ? LL(...ERR[errKey]!) : errText}</div>}

      <ol className="adv-steps" aria-label={LL('Procedura', 'Procédure')}>
        {([['s1', 'Richiesta', 'Demande', cnt('requested'), LL('da autorizzare', 'à autoriser')], ['s2', 'Autorizzazione', 'Autorisation', cnt('authorized'), LL('da consegnare', 'à remettre')],
          ['s3', 'Consegna', 'Remise', cnt('delivered'), LL('in corso', 'en cours')], ['s4', 'Rendiconto', 'Rapport', cnt('reported'), LL('in verifica', 'en vérification')],
          ['s5', 'Chiusura', 'Clôture', cnt('closed'), LL('chiusi', 'clôturées')]] as const).map(([c, it, fr, n, sub], i) => (
          <li key={c} className={c}><span className="as-n">{i + 1}</span><b>{LL(it, fr)}</b><small><span className="num">{n}</span> {sub}</small></li>))}
      </ol>

      <Panel title={LL('Richieste', 'Demandes')} right={<Link className="btn small ghost" href={chiusi ? '/anticipi' : '/anticipi?chiusi=1'}>{chiusi ? LL('Solo aperte', 'Ouvertes seulement') : LL('Mostra anche chiuse', 'Afficher aussi les clôturées')}</Link>}>
        {shown.length === 0 ? <Empty text={LL('Nessuna richiesta aperta.', 'Aucune demande ouverte.')} /> : (
          <ul className="adv-req">
            {shown.map((r) => {
              const acc = accBy.get(r.account_id), st = STEP[r.status] ?? STEP.requested!, amt = Number(r.authorized_amount ?? r.amount);
              const late = r.status === 'delivered' && r.report_by < today2;
              const mineReq = r.requested_by === me.id, mineBen = r.beneficiary_id === me.id;
              return (
                <li key={r.id} className={st[0]}>
                  <div className="ar-main">
                    <div className="ar-top"><span className={`chip st ${st[0]}`}>{LL(st[1], st[2])}</span><b>{acc?.holder ?? '–'}</b>
                      <span className="num ar-amt">{money(amt, r.currency, lang)}</span></div>
                    <div className="ar-p">{r.purpose}{r.project_id && prjBy.get(r.project_id) ? <span className="muted"> · {prjBy.get(r.project_id)}</span> : null}</div>
                    <div className="muted small">{LL('uso', 'usage')} {date(r.use_date)} · {LL('giustificare entro', 'justifier avant le')} <span className={late ? 'neg' : ''}>{date(r.report_by)}</span>
                      {' · '}{LL('chiesto da', 'demandé par')} {who.get(r.requested_by) ?? '–'}
                      {r.authorized_by ? <> · {r.status === 'rejected' ? LL('respinto da', 'refusé par') : LL('autorizzato da', 'autorisé par')} {who.get(r.authorized_by) ?? '–'}</> : null}
                      {r.board_ref ? <> · {r.board_ref}</> : null}{r.decision_note ? <> · {r.decision_note}</> : null}</div>
                  </div>
                  <div className="ar-act">
                    {r.status === 'requested' && resp && !mineReq && !mineBen && (
                      <details className="ar-pop"><summary className="btn small primary">{LL('Autorizza', 'Autoriser')}</summary>
                        <form action={advanceStep} className="ar-form">
                          <input type="hidden" name="id" value={r.id} /><input type="hidden" name="step" value="authorize" />
                          <label className="field"><span className="flabel">{LL('Importo autorizzato', 'Montant autorisé')} ({r.currency})</span>
                            <input className="input num" name="amount" inputMode="decimal" defaultValue={Number(r.amount).toLocaleString('it-IT', { useGrouping: 'always' } as Intl.NumberFormatOptions)} /></label>
                          <label className="field"><span className="flabel">{LL('Delibera del Consiglio (solo oltre soglia)', 'Délibération du Conseil (au-delà du seuil)')}</span>
                            <input className="input" name="board_ref" maxLength={300} /></label>
                          <label className="field"><span className="flabel">{LL('Nota', 'Note')}</span><input className="input" name="note" maxLength={500} /></label>
                          <button className="btn primary" type="submit">{LL('Autorizza', 'Autoriser')}</button>
                        </form></details>)}
                    {r.status === 'requested' && resp && !mineReq && !mineBen && (
                      <form action={advanceStep}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="step" value="reject" />
                        <button className="btn small ghost" type="submit">{LL('Respingi', 'Refuser')}</button></form>)}
                    {r.status === 'requested' && resp && (mineReq || mineBen) && <span className="muted small">{LL('la autorizza un altro', 'autorisée par une autre personne')}</span>}
                    {r.status === 'authorized' && resp && !mineBen && (
                      <details className="ar-pop"><summary className="btn small primary">{LL('Consegna', 'Remettre')}</summary>
                        <form action={deliverAdvance} className="ar-form">
                          <input type="hidden" name="id" value={r.id} /><input type="hidden" name="client_uuid" value={randomUUID()} />
                          <label className="field"><span className="flabel">{LL('Dalla cassa', 'Depuis la caisse')}</span>
                            <select className="input" name="cash" required>{(cash ?? []).filter((a) => a.currency === r.currency).map((a) => <option key={a.id} value={a.id}>{L(a)}</option>)}</select></label>
                          <label className="field"><span className="flabel">{t('f_op_date')}</span><input className="input" name="date" type="date" defaultValue={today2} required /></label>
                          <button className="btn primary" type="submit">{LL('Registra la consegna', 'Enregistrer la remise')}</button>
                        </form></details>)}
                    {r.status === 'delivered' && (resp || mineReq || mineBen) && writer && (
                      <form action={advanceStep}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="step" value="report" />
                        <button className="btn small" type="submit">{LL('Spese registrate: rendiconto pronto', 'Dépenses saisies : rapport prêt')}</button></form>)}
                    {(r.status === 'delivered' || r.status === 'reported') && resp && !mineBen && (
                      <details className="ar-pop"><summary className="btn small primary">{LL('Chiudi', 'Clôturer')}</summary>
                        <form action={advanceStep} className="ar-form">
                          <input type="hidden" name="id" value={r.id} /><input type="hidden" name="step" value="close" />
                          <p className="muted small" style={{ margin: 0 }}>{LL('Prima registra la restituzione del residuo (sotto, «Consegna o restituzione») o il rimborso dell’eccedenza.', 'Enregistrez d’abord la restitution du reliquat (ci-dessous) ou le remboursement de l’excédent.')}</p>
                          <label className="field"><span className="flabel">{LL('Nota di chiusura', 'Note de clôture')}</span><input className="input" name="note" maxLength={500} /></label>
                          <button className="btn primary" type="submit">{LL('Chiudi l’anticipo', 'Clôturer l’avance')}</button>
                        </form></details>)}
                    {(r.status === 'requested' || r.status === 'authorized') && (resp || mineReq) && writer && (
                      <form action={advanceStep}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="step" value="cancel" />
                        <button className="btn small ghost" type="submit">{LL('Annulla', 'Annuler')}</button></form>)}
                    <Link className="btn small ghost" href={`/anticipi/${r.id}`}>{LL('Scheda e stampa', 'Fiche et impression')}</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {writer && (advAcc ?? []).length > 0 && (<>
        <div id="nuova-richiesta" />
        <Panel title={LL('Nuova richiesta', 'Nouvelle demande')} pad>
          <form action={requestAdvance} className="fgrid">
            <div className="field"><label htmlFor="rq-acc">{LL('Chi riceve l’anticipo', 'Qui reçoit l’avance')}</label>
              <select className="input" id="rq-acc" name="account" required>{(advAcc ?? []).map((a) => <option key={a.id} value={a.id}>{a.holder} · {a.currency}</option>)}</select></div>
            <div className="field"><label htmlFor="rq-ben">{LL('È un utente dell’app?', 'Est-ce un utilisateur de l’app ?')}</label>
              <select className="input" id="rq-ben" name="beneficiary" defaultValue=""><option value="">{LL('No / non so', 'Non / je ne sais pas')}</option>
                {(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
            <div className="field"><label htmlFor="rq-rk">{LL('Ruolo', 'Rôle')}</label>
              <select className="input" id="rq-rk" name="role_kind" defaultValue="volunteer"><option value="volunteer">{LL('Volontario', 'Bénévole')}</option>
                <option value="employee">{LL('Dipendente o collaboratore', 'Salarié ou collaborateur')}</option><option value="contact">{LL('Referente locale', 'Référent local')}</option>
                <option value="other">{LL('Altro', 'Autre')}</option></select></div>
            <div className="field"><label htmlFor="rq-amt">{t('amount')}</label><input className="input num" id="rq-amt" name="amount" inputMode="decimal" required placeholder="0" /></div>
            <div className="field span2"><label htmlFor="rq-p">{LL('Per cosa serve', 'Pour quoi faire')}</label>
              <input className="input" id="rq-p" name="purpose" required minLength={3} maxLength={500} placeholder={LL('Es. materiale per il laboratorio di cucito, Antanetibe', 'Ex. matériel pour l’atelier de couture, Antanetibe')} /></div>
            <div className="field"><label htmlFor="rq-prj">{t('project')}</label>
              <select className="input" id="rq-prj" name="project" defaultValue=""><option value="">–</option>{(prj ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="field"><label htmlFor="rq-use">{LL('Data d’uso', 'Date d’usage')}</label><input className="input" id="rq-use" name="use_date" type="date" defaultValue={today2} required /></div>
            <div className="field"><label htmlFor="rq-by">{LL('Giustificare entro (15 giorni, massimo 30)', 'Justifier avant (15 jours, max 30)')}</label>
              <input className="input" id="rq-by" name="report_by" type="date" defaultValue={plus(today2, 15)} /></div>
            <div className="span2"><button className="btn primary" type="submit">{LL('Invia la richiesta', 'Envoyer la demande')}</button>
              <span className="muted small" style={{ marginLeft: 10 }}>{limits.resp || limits.admin
                ? LL(`Soglie: responsabile fino a ${num(limits.resp ?? 0, lang)} €, amministratore fino a ${num(limits.admin ?? 0, lang)} €, oltre serve la delibera del Consiglio.`, `Seuils : responsable jusqu’à ${num(limits.resp ?? 0, lang)} €, administrateur jusqu’à ${num(limits.admin ?? 0, lang)} €, au-delà délibération du Conseil.`) + (limits.ref ? ` (${limits.ref})` : '')
                : LL('Soglie di autorizzazione non ancora impostate: autorizza un responsabile o un amministratore.', 'Seuils d’autorisation non encore définis : un responsable ou un administrateur autorise.')}</span></div>
          </form>
        </Panel>
      </>)}
      <ErrorNote prefix={t('error_load')} error={error} />

      {staff && <h2 className="sec-h">{LL('Saldi per persona', 'Soldes par personne')}</h2>}
      {rows.length > 0 && (
        <section className="panel">
          <div className="figs">
            {[...totals.entries()].map(([cur, v]) => (
              <div key={cur}><span>{t('adv_total')} · {cur}</span><b className="num">{money(v, cur, lang)}</b></div>
            ))}
            <div className={rows.some((r) => Number(r.balance) > 0 && days(r.open_since) > LATE_DAYS) ? 'bad' : ''}>
              <span>{t('adv_late')}</span><b className="num">{rows.filter((r) => Number(r.balance) > 0 && days(r.open_since) > LATE_DAYS).length}</b></div>
            <div><span>{t('adv_no_doc')}</span><b className="num">{rows.reduce((s, r) => s + r.spent_no_doc, 0)}</b></div>
          </div>
        </section>
      )}

      {staff && <Panel>
        {rows.length === 0 ? <Empty text={t('adv_none')} /> : (
          <div className="tscroll">
            <table className="t">
              <thead><tr>
                <th>{t('adv_person')}</th><th className="r">{t('adv_given')}</th><th className="r">{t('adv_spent')}</th>
                <th className="r">{t('adv_returned')}</th><th className="r">{t('adv_balance')}</th><th>{t('adv_open_since')}</th><th />
              </tr></thead>
              <tbody>
                {rows.map((r) => {
                  const bal = Number(r.balance), d = days(r.open_since), late = bal > 0 && d > LATE_DAYS;
                  return (
                    <tr key={r.account_id} className={r.active ? '' : 'muted'}>
                      <td><Link href={`/movimenti?conto=${r.account_id}`}><b>{r.holder}</b></Link> <span className="muted">· {r.currency}</span></td>
                      <td className="r num">{money(r.given, r.currency, lang)}</td>
                      <td className="r num">{money(r.spent, r.currency, lang)}</td>
                      <td className="r num">{money(r.returned, r.currency, lang)}</td>
                      <td className={`r num ${bal < 0 ? 'neg' : ''}`}><b>{money(bal, r.currency, lang)}</b></td>
                      <td className="nw">{bal > 0 && r.open_since
                        ? <>{date(r.open_since)} <span className={`chip ${late ? 'warn' : ''}`}>{t('adv_days').replace('{n}', String(d))}</span></> : '–'}</td>
                      <td>
                        <span className="chips">
                          {r.spent_no_doc > 0 && <Link className="chip warn" href={`/movimenti?conto=${r.account_id}`}>{t('adv_no_doc')}: {r.spent_no_doc}</Link>}
                          {r.aut_to_sign > 0 && <span className="chip warn">{t('adv_aut_to_sign')}: {r.aut_to_sign}</span>}
                          {r.unverified > 0 && <span className="chip">{r.unverified} {t('adv_unverified')}</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>}

      {resp && active.length > 0 && (
        <Panel title={LL('Consegna o restituzione senza richiesta (per la restituzione del residuo)', 'Remise ou restitution sans demande (restitution du reliquat)')} pad>
          <p className="muted" style={{ marginTop: 0 }}>{t('adv_move_text')}</p>
          <form action={moveAdvance} className="fgrid">
            <input type="hidden" name="client_uuid" value={randomUUID()} />
            <div className="field">
              <label htmlFor="adv">{t('adv_person')}</label>
              <select className="input" id="adv" name="advance" required>
                {active.map((r) => <option key={r.account_id} value={r.account_id}>{r.holder} · {r.currency}</option>)}
              </select>
            </div>
            <div className="field">
              <span className="flabel" id="advop">{t('adv_op')}</span>
              <div className="seg" role="radiogroup" aria-labelledby="advop">
                <label className="seg-opt"><input type="radio" name="op" value="give" defaultChecked /> {t('adv_give')}</label>
                <label className="seg-opt"><input type="radio" name="op" value="return" /> {t('adv_return')}</label>
              </div>
            </div>
            <div className="field">
              <label htmlFor="advcash">{t('adv_cash_acc')}</label>
              <select className="input" id="advcash" name="cash" required>
                {(cash ?? []).map((a) => <option key={a.id} value={a.id}>{L(a)} · {a.currency}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="advamt">{t('amount')}</label>
              <input className="input num" id="advamt" name="amount" inputMode="decimal" required placeholder="0" />
            </div>
            <div className="field">
              <label htmlFor="advdate">{t('f_op_date')}</label>
              <input className="input" id="advdate" name="date" type="date" defaultValue={today} required />
            </div>
            <div className="field">
              <label htmlFor="advnotes">{t('f_notes')}</label>
              <input className="input" id="advnotes" name="notes" maxLength={300} />
            </div>
            <div className="span2"><button className="btn primary" type="submit">{t('adv_save')}</button></div>
          </form>
        </Panel>
      )}

      {resp && (
        <details className="panel">
          <summary className="panel-h" style={{ cursor: 'pointer' }}><H2 text={t('adv_new_person')} /></summary>
          <div className="panel-b">
            <p className="muted" style={{ marginTop: 0 }}>{t('adv_new_text')}</p>
            <form action={createAdvanceAccount} className="fgrid">
              <div className="field">
                <label htmlFor="holder">{t('adv_holder')}</label>
                <input className="input" id="holder" name="holder" required maxLength={120} />
              </div>
              <div className="field">
                <label htmlFor="advcur">{t('currency')}</label>
                <select className="input" id="advcur" name="currency" defaultValue="MGA"><option>MGA</option><option>EUR</option></select>
              </div>
              <div className="field">
                <label htmlFor="advloc">{t('place')}</label>
                <select className="input" id="advloc" name="location" defaultValue="MG">
                  <option value="MG">{t('madagascar')}</option><option value="IT">{t('italy')}</option>
                </select>
              </div>
              <div className="span2"><button className="btn" type="submit">{t('adv_create')}</button></div>
            </form>
          </div>
        </details>
      )}
    </div>
  );
}
