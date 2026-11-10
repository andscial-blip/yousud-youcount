import { PersonPicker } from '@/components/PersonPicker';
import { AdvanceDoc } from '@/components/AdvanceDoc';
import { CIcon } from '@/components/CIcon';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { RESP, STAFF, can, requireMe } from '@/lib/session';
import { date, money, num } from '@/lib/format';
import type { Key } from '@/lib/i18n';
import { Denied, Empty, ErrorNote, PageHead, Panel, H2 } from '@/components/Page';
import { advanceStep, closeSettled, createAdvanceAccount, deliverAdvance, moveAdvance, requestAdvance } from './actions';

export const dynamic = 'force-dynamic';

type S = { account_id: string; code: string; name_it: string; name_fr: string; holder: string; currency: string; active: boolean;
  given: string; spent: string; returned: string; balance: string; open_since: string | null; last_move: string | null;
  spent_count: number; spent_no_doc: number; aut_to_sign: number; unverified: number };
type Req = { id: string; account_id: string; beneficiary_id: string | null; role_kind: string; amount: string; currency: string; amount_eur: string | null;
  purpose: string; project_id: string | null; use_date: string; report_by: string; status: string; requested_by: string; requested_at: string;
  authorized_by: string | null; authorized_amount: string | null; board_ref: string | null; decision_note: string | null; delivered_at: string | null;
  reported_at: string | null; closed_at: string | null; delivery_movement_id: string | null; estimate_document_id?: string | null; delivery_document_id?: string | null };
type Mov = { id: string; ref: string | null; op_date: string; kind: string; amount: string; to_amount: string | null; account_id: string; to_account_id: string | null;
  description: string | null; status: string; movement_documents: { document_id: string }[] };

// Anticipi di cassa, concept B (scelta del 10/11): il portafoglio della persona.
// In alto quello che chiede un'azione (autorizzare, consegnare); poi una riga per persona con quanto ha in mano;
// aprendola si vede l'estratto (consegne, ricevute, restituzioni) con i tasti «+ Ricevuta», «Restituzione», «Nuova richiesta».
export default async function Advances({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; persona?: string; nuova?: string; per?: string; ric?: string; n?: string; chiusi?: string }> }) {
  const sp = await searchParams;
  const { ok, err } = sp;
  const { supabase, me, t, lang } = await requireMe();
  if (!me) return <Denied text={t('only_staff')} />;
  const staff = can(me, STAFF), resp = can(me, RESP), writer = me.role !== 'read_only';
  const FR = lang === 'fr', LL = (it: string, fr: string) => (FR ? fr : it);
  const persona = /^[0-9a-f-]{36}$/.test(sp.persona ?? '') ? sp.persona! : '';
  const [{ data, error }, { data: cash }, { data: reqRaw }, { data: advAcc }, { data: people }, { data: prj }, { data: lim }, { data: movs }] = await Promise.all([
    staff ? supabase.rpc('advance_summary') : Promise.resolve({ data: [], error: null }),
    supabase.from('accounts').select('id, name_it, name_fr, currency').eq('active', true).neq('kind', 'advance').order('sort'),
    supabase.from('advance_requests').select('*').order('requested_at', { ascending: false }).limit(300).returns<Req[]>(),
    supabase.from('accounts').select('id, holder, name_it, name_fr, currency').eq('kind', 'advance').eq('active', true).order('holder'),
    supabase.from('profiles').select('id, full_name').eq('active', true).order('full_name'),
    supabase.from('projects').select('id, name').eq('active', true).order('name'),
    supabase.from('settings').select('value').eq('key', 'adv_limits').maybeSingle(),
    persona && staff ? supabase.from('movements').select('id, ref, op_date, kind, amount, to_amount, account_id, to_account_id, description, status, movement_documents(document_id)')
      .or(`account_id.eq.${persona},to_account_id.eq.${persona}`).order('op_date', { ascending: false }).limit(200).returns<Mov[]>() : Promise.resolve({ data: [] as Mov[] }),
  ]);
  const rows = (data ?? []) as S[];
  const today = new Date().toISOString().slice(0, 10);
  const plus = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
  const L = (o: { name_it: string; name_fr: string | null }) => (lang === 'fr' && o.name_fr ? o.name_fr : o.name_it);
  const reqs = reqRaw ?? [];
  const accName = (a?: { holder?: string | null; name_it?: string | null; name_fr?: string | null } | null) => a ? (a.holder || (lang === 'fr' ? a.name_fr || a.name_it : a.name_it) || '–') : '–';
  const pickAcc = (advAcc ?? []).map((a) => ({ id: a.id, label: `${accName(a)} · ${a.currency}` }));
  const holders = new Set((advAcc ?? []).map((a) => (a.holder ?? '').toLowerCase()));
  const pickUsers = (people ?? []).filter((p) => p.full_name && !holders.has(String(p.full_name).toLowerCase())).map((p) => ({ id: p.id as string, name: p.full_name as string }));
  const accBy = new Map((advAcc ?? []).map((a) => [a.id, a]));
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name as string]));
  const prjBy = new Map((prj ?? []).map((p) => [p.id, p.name as string]));
  const limits = (lim?.value ?? {}) as { resp?: number; admin?: number; ref?: string | null };
  const ERR: Record<string, [string, string]> = {
    four_eyes: ['Chi autorizza, consegna o chiude non può essere chi ha chiesto o chi riceve l’anticipo.', 'Qui autorise, remet ou clôture ne peut pas être qui a demandé ou qui reçoit l’avance.'],
    over_limit: ['Importo oltre la soglia del responsabile: serve un amministratore.', 'Montant au-delà du seuil du responsable : il faut un administrateur.'],
    board_needed: ['Importo oltre la soglia dell’amministratore: indica gli estremi della delibera del Consiglio.', 'Montant au-delà du seuil de l’administrateur : indiquez la délibération du Conseil.'],
    advance_overdue: ['Questa persona ha un anticipo da giustificare oltre la scadenza: prima vanno portate le ricevute o restituito il resto.', 'Cette personne a une avance à justifier en retard : il faut d’abord apporter les reçus ou restituer le reste.'],
    invalid_state: ['La richiesta è già passata a un altro stato: ricarica la pagina.', 'La demande a déjà changé d’état : rechargez la page.'],
    not_settled: ['Il saldo non è a zero: mancano ricevute o la restituzione del resto.', 'Le solde n’est pas à zéro : il manque des reçus ou la restitution du reste.'] };
  const errKey = err?.split(':')[0] ?? '';
  const errText = err ? (ERR[errKey] ? LL(...ERR[errKey]!) : err === 'no_rate' ? t('adv_no_rate') : (() => { const k = `err_${errKey}` as Key; const v = t(k); return v && v !== k ? v : err; })()) : null;
  const okText = ok === 'req' ? LL('Richiesta inviata: ora la autorizza il direttore o un responsabile.', 'Demande envoyée : le directeur ou un responsable va l’autoriser.')
    : ok === 'authorize' ? LL('Anticipo autorizzato: ora si consegnano i contanti.', 'Avance autorisée : on remet maintenant les espèces.') : ok === 'reject' ? LL('Richiesta respinta.', 'Demande refusée.')
    : ok === 'deliver' ? LL('Consegna registrata: stampa la ricevuta di consegna e falla firmare.', 'Remise enregistrée : imprimez le reçu de remise et faites-le signer.')
    : ok === 'closed' ? LL(`Saldo a zero: ${sp.n ?? 1} anticipo chiuso.`, `Solde à zéro : ${sp.n ?? 1} avance clôturée.`)
    : ok === 'cancel' ? LL('Richiesta annullata.', 'Demande annulée.') : ok ? t('adv_saved') : null;

  // preventivi e ricevute di consegna: link temporanei ai file (spazio privato dell'ente)
  const docIds = [...new Set(reqs.filter((r) => ['requested', 'authorized', 'delivered', 'reported'].includes(r.status) || r.account_id === persona)
    .flatMap((r) => [r.estimate_document_id, r.delivery_document_id]).filter((x): x is string => Boolean(x)))].slice(0, 60);
  const docUrl = new Map<string, string>();
  if (docIds.length) {
    const { data: ds } = await supabase.from('documents').select('id, original_path, file_name').in('id', docIds);
    const bucket = supabase.storage.from('documents');
    await Promise.all((ds ?? []).map(async (d) => { const u = (await bucket.createSignedUrl(d.original_path, 900)).data?.signedUrl; if (u) docUrl.set(d.id, u); }));
  }

  // ── cose da fare ──
  const toAuth = reqs.filter((r) => r.status === 'requested');
  const toGive = reqs.filter((r) => r.status === 'authorized');
  const amt = (r: Req) => Number(r.authorized_amount ?? r.amount);
  const lateReq = (acc: string) => reqs.find((r) => r.account_id === acc && (r.status === 'delivered' || r.status === 'reported') && r.report_by < today);
  const nextDue = (acc: string) => reqs.filter((r) => r.account_id === acc && r.status === 'delivered').map((r) => r.report_by).sort()[0];
  const inHand = new Map<string, number>();
  for (const r of rows) if (Number(r.balance) > 0) inHand.set(r.currency, (inHand.get(r.currency) ?? 0) + Number(r.balance));
  const wallets = rows.filter((r) => r.active && (Number(r.balance) !== 0 || reqs.some((q) => q.account_id === r.account_id && ['requested', 'authorized', 'delivered', 'reported'].includes(q.status))))
    .sort((a, b) => Number(Boolean(lateReq(b.account_id))) - Number(Boolean(lateReq(a.account_id))) || Number(b.balance) - Number(a.balance));
  const others = rows.filter((r) => r.active && !wallets.includes(r));
  const mine = reqs.filter((r) => r.requested_by === me.id || r.beneficiary_id === me.id);
  const href = (q: Record<string, string | undefined>) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(q)) if (v) u.set(k, v); const s = u.toString(); return `/anticipi${s ? `?${s}` : ''}`; };

  // ── portafoglio aperto ──
  const W = persona ? rows.find((r) => r.account_id === persona) ?? null : null;
  const wAcc = persona ? accBy.get(persona) : undefined;
  const wReqs = persona ? reqs.filter((r) => r.account_id === persona) : [];
  const wOpen = wReqs.filter((r) => ['requested', 'authorized'].includes(r.status));
  const wBal = W ? Number(W.balance) : 0;
  const wCur = W?.currency ?? wAcc?.currency ?? 'MGA';
  const settled = W && Math.abs(wBal) < 0.005 && wReqs.some((r) => r.status === 'delivered' || r.status === 'reported');
  const line = (m: Mov) => {
    const inc = m.kind === 'transfer' && m.to_account_id === persona;
    const v = inc ? Number(m.to_amount ?? m.amount) : -Number(m.amount);
    const label = m.kind === 'transfer' ? (inc ? LL('Consegna', 'Remise') : LL('Restituzione', 'Restitution')) : LL('Spesa', 'Dépense');
    return { v, label };
  };
  const STATUS: Record<string, [string, string, string]> = { requested: ['warn', 'da autorizzare', 'à autoriser'], authorized: ['ok', 'autorizzata, da consegnare', 'autorisée, à remettre'],
    delivered: ['', 'consegnata', 'remise'], reported: ['', 'in verifica', 'en vérification'], closed: ['', 'chiusa', 'clôturée'], rejected: ['bad', 'respinta', 'refusée'], cancelled: ['', 'annullata', 'annulée'] };
  const chip = (s: string) => <span className={`chip ${STATUS[s]?.[0] ?? ''}`}>{LL(STATUS[s]?.[1] ?? s, STATUS[s]?.[2] ?? s)}</span>;
  const docLink = (id: string | null | undefined, txt: string) => (id && docUrl.get(id) ? <a className="adv-doc" href={docUrl.get(id)} target="_blank" rel="noreferrer"><CIcon name="file" size={14} />{txt}</a> : id ? <span className="adv-doc">{txt}</span> : null);
  const nuova = sp.nuova === '1' && writer;
  const perDef = /^[0-9a-f-]{36}$/.test(sp.per ?? '') && accBy.has(sp.per!) ? `acc:${sp.per}` : undefined;
  const reqLine = (r: Req) => (
    <div className="aw-rq-m">
      <b>{accName(accBy.get(r.account_id))}</b> <span className="num">{money(amt(r), r.currency, lang)}</span>
      <div className="aw-p">{r.purpose}{r.project_id && prjBy.get(r.project_id) ? <span className="muted"> · {prjBy.get(r.project_id)}</span> : null}</div>
      <div className="muted small">{LL('chiesta da', 'demandée par')} {who.get(r.requested_by) ?? '–'} · {date(r.requested_at.slice(0, 10))} · {LL('uso', 'usage')} {date(r.use_date)}
        {r.estimate_document_id ? <> · {docLink(r.estimate_document_id, LL('preventivo', 'devis'))}</> : <> · <span className="neg">{LL('senza preventivo', 'sans devis')}</span></>}</div>
    </div>
  );

  return (
    <div className="stack">
      <PageHead title={t('nav_advances')}>
        {writer && <Link className="btn primary" href={href({ nuova: '1', per: persona || undefined })} scroll={false}>+ {LL('Nuova richiesta', 'Nouvelle demande')}</Link>}
      </PageHead>
      {okText && <div className="note ok" role="status">{okText}{ok === 'deliver' && sp.ric ? <> <Link href={`/anticipi/${sp.ric}`}>{LL('Apri la ricevuta di consegna →', 'Ouvrir le reçu de remise →')}</Link></> : null}</div>}
      {errText && <div className="note err">{errText}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />

      {staff && (
        <div className="kpi4 aw-k">
          <div className="k4 k-in"><span className="k4-t"><CIcon name="wallet" size={15} />{LL('In mano alle persone', 'Entre les mains des personnes')}</span>
            <b className="num">{[...inHand.entries()].map(([c, v]) => money(v, c, lang)).join(' · ') || '–'}</b><small>{(() => { const n = wallets.filter((w) => Number(w.balance) > 0).length; return n === 1 ? LL('1 persona', '1 personne') : LL(`${n} persone`, `${n} personnes`); })()}</small></div>
          <div className={`k4 ${toAuth.length ? 'k-warn' : 'k-net'}`}><span className="k4-t"><CIcon name="check" size={15} />{LL('Da autorizzare', 'À autoriser')}</span><b className="num">{toAuth.length}</b>
            <small>{LL('richieste in attesa', 'demandes en attente')}</small></div>
          <div className={`k4 ${toGive.length ? 'k-warn' : 'k-net'}`}><span className="k4-t"><CIcon name="send" size={15} />{LL('Da consegnare', 'À remettre')}</span><b className="num">{toGive.length}</b>
            <small>{LL('autorizzate', 'autorisées')}</small></div>
          <div className={`k4 ${wallets.some((w) => lateReq(w.account_id)) ? 'k-out' : 'k-net'}`}><span className="k4-t"><CIcon name="clock" size={15} />{LL('Ricevute in ritardo', 'Reçus en retard')}</span>
            <b className="num">{wallets.filter((w) => lateReq(w.account_id)).length}</b><small>{LL('oltre la data per giustificare', 'au-delà de la date prévue')}</small></div>
        </div>
      )}

      {resp && toAuth.length > 0 && (
        <Panel title={`${LL('Da autorizzare', 'À autoriser')} · ${toAuth.length}`}>
          <ul className="aw-rq">
            {toAuth.map((r) => {
              const self = r.requested_by === me.id || r.beneficiary_id === me.id;
              return (
                <li key={r.id}>{reqLine(r)}
                  <div className="aw-act">
                    {self ? <span className="muted small">{LL('la autorizza un’altra persona', 'autorisée par une autre personne')}</span> : (<>
                      <details className="ar-pop"><summary className="btn small primary">{LL('Autorizza', 'Autoriser')}</summary>
                        <form action={advanceStep} className="ar-form">
                          <input type="hidden" name="id" value={r.id} /><input type="hidden" name="step" value="authorize" />
                          <label className="field"><span className="flabel">{LL('Importo autorizzato', 'Montant autorisé')} ({r.currency})</span>
                            <input className="input num" name="amount" inputMode="decimal" defaultValue={Number(r.amount).toLocaleString('it-IT', { useGrouping: 'always' } as Intl.NumberFormatOptions)} /></label>
                          <label className="field"><span className="flabel">{LL('Delibera del Consiglio (solo oltre soglia)', 'Délibération du Conseil (au-delà du seuil)')}</span>
                            <input className="input" name="board_ref" maxLength={300} /></label>
                          <button className="btn primary" type="submit">{LL('Autorizza', 'Autoriser')}</button>
                        </form></details>
                      <details className="ar-pop"><summary className="btn small">{LL('Respingi', 'Refuser')}</summary>
                        <form action={advanceStep} className="ar-form">
                          <input type="hidden" name="id" value={r.id} /><input type="hidden" name="step" value="reject" />
                          <label className="field"><span className="flabel">{LL('Motivo', 'Motif')}</span><input className="input" name="note" maxLength={500} /></label>
                          <button className="btn" type="submit">{LL('Respingi la richiesta', 'Refuser la demande')}</button>
                        </form></details></>)}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {resp && toGive.length > 0 && (
        <Panel title={`${LL('Da consegnare', 'À remettre')} · ${toGive.length}`}>
          <ul className="aw-rq">
            {toGive.map((r) => (
              <li key={r.id}>{reqLine(r)}
                <div className="aw-act">
                  {r.beneficiary_id === me.id ? <span className="muted small">{LL('la consegna un’altra persona', 'remise par une autre personne')}</span> : (
                    <details className="ar-pop"><summary className="btn small primary">{LL('Consegna i contanti', 'Remettre les espèces')}</summary>
                      <form action={deliverAdvance} className="ar-form">
                        <input type="hidden" name="id" value={r.id} /><input type="hidden" name="client_uuid" value={randomUUID()} />
                        <label className="field"><span className="flabel">{LL('Dalla cassa', 'Depuis la caisse')}</span>
                          <select className="input" name="cash" required>{(cash ?? []).filter((a) => a.currency === r.currency).map((a) => <option key={a.id} value={a.id}>{L(a)}</option>)}</select></label>
                        <label className="field"><span className="flabel">{t('f_op_date')}</span><input className="input" name="date" type="date" defaultValue={today} required /></label>
                        <button className="btn primary" type="submit">{LL('Registra e prepara la ricevuta', 'Enregistrer et préparer le reçu')}</button>
                      </form></details>)}
                  <form action={advanceStep}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="step" value="cancel" />
                    <button className="btn small ghost" type="submit">{LL('Annulla', 'Annuler')}</button></form>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {staff && (
        <Panel title={LL('Chi ha contanti in mano', 'Qui a des espèces')}>
          {wallets.length === 0 ? <Empty text={LL('Nessuno ha contanti da giustificare.', 'Personne n’a d’espèces à justifier.')} /> : (
            <ul className="aw-list">
              {wallets.map((w) => {
                const bal = Number(w.balance), late = lateReq(w.account_id), due = nextDue(w.account_id), pend = reqs.filter((q) => q.account_id === w.account_id && ['requested', 'authorized'].includes(q.status)).length;
                return (
                  <li key={w.account_id}>
                    <Link href={href({ persona: w.account_id })} scroll={false} className={w.account_id === persona ? 'sel' : ''}>
                      <span className="aw-n"><b>{accName(w)}</b><small className="muted">{late ? <span className="neg">{LL(`ricevute in ritardo dal ${date(late.report_by)}`, `reçus en retard depuis le ${date(late.report_by)}`)}</span>
                        : due ? LL(`ricevute entro il ${date(due)}`, `reçus avant le ${date(due)}`) : bal < 0 ? LL('da rimborsare alla persona', 'à rembourser à la personne') : LL('nessuna scadenza', 'aucune échéance')}
                        {w.spent_no_doc > 0 ? ` · ${LL(`${w.spent_no_doc} senza ricevuta`, `${w.spent_no_doc} sans reçu`)}` : ''}{pend ? ` · ${LL(`${pend} richiesta in corso`, `${pend} demande en cours`)}` : ''}</small></span>
                      <span className={`aw-b num ${bal < 0 ? 'neg' : bal > 0 ? 'pos' : ''}`}>{money(bal, w.currency, lang)}<small>{bal < 0 ? LL('anticipato dalla persona', 'avancé par la personne') : LL('in mano', 'en main')}</small></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {others.length > 0 && <details className="aw-more"><summary>{others.length === 1 ? LL('Un’altra persona senza contanti in mano', 'Une autre personne sans espèces') : LL(`Altre ${others.length} persone senza contanti in mano`, `${others.length} autres personnes sans espèces`)}</summary>
            <ul className="aw-list">{others.map((w) => <li key={w.account_id}><Link href={href({ persona: w.account_id })} scroll={false}><span className="aw-n"><b>{accName(w)}</b><small className="muted">{w.currency}</small></span><span className="aw-b num">{money(0, w.currency, lang)}</span></Link></li>)}</ul></details>}
        </Panel>
      )}

      {!staff && (
        <Panel title={LL('Le mie richieste', 'Mes demandes')}>
          {mine.length === 0 ? <Empty text={LL('Nessuna richiesta. Per chiedere contanti usa «+ Nuova richiesta».', 'Aucune demande. Pour demander des espèces, utilisez « + Nouvelle demande ».')} /> : (
            <ul className="aw-rq">
              {mine.slice(0, 30).map((r) => (
                <li key={r.id}>{reqLine(r)}<div className="aw-act">{chip(r.status)}
                  {(r.status === 'requested' || r.status === 'authorized') && writer && r.requested_by === me.id && (
                    <form action={advanceStep}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="step" value="cancel" />
                      <button className="btn small ghost" type="submit">{LL('Annulla', 'Annuler')}</button></form>)}
                  {r.status === 'delivered' && <Link className="btn small" href={`/nuovo?tipo=expense&conto=${r.account_id}`}>+ {LL('Ricevuta', 'Reçu')}</Link>}</div></li>))}
            </ul>
          )}
        </Panel>
      )}

      {resp && (
        <details className="panel aw-other">
          <summary className="panel-h" style={{ cursor: 'pointer' }}><H2 text={LL('Altre operazioni', 'Autres opérations')} /></summary>
          <div className="panel-b stack">
            <p className="muted" style={{ margin: 0 }}>{t('adv_move_text')}</p>
            <form action={moveAdvance} className="fgrid">
              <input type="hidden" name="client_uuid" value={randomUUID()} />
              <PersonPicker id="adv" label={t('adv_person')} lang={lang} accounts={pickAcc} users={pickUsers} currency={false} />
              <div className="field"><span className="flabel" id="advop">{t('adv_op')}</span>
                <div className="seg" role="radiogroup" aria-labelledby="advop">
                  <label className="seg-opt"><input type="radio" name="op" value="give" defaultChecked /> {t('adv_give')}</label>
                  <label className="seg-opt"><input type="radio" name="op" value="return" /> {t('adv_return')}</label></div></div>
              <div className="field"><label htmlFor="advcash">{t('adv_cash_acc')}</label>
                <select className="input" id="advcash" name="cash" required>{(cash ?? []).map((a) => <option key={a.id} value={a.id}>{L(a)} · {a.currency}</option>)}</select></div>
              <div className="field"><label htmlFor="advamt">{t('amount')}</label><input className="input num" id="advamt" name="amount" inputMode="decimal" required placeholder="0" /></div>
              <div className="field"><label htmlFor="advdate">{t('f_op_date')}</label><input className="input" id="advdate" name="date" type="date" defaultValue={today} required /></div>
              <div className="field"><label htmlFor="advnotes">{t('f_notes')}</label><input className="input" id="advnotes" name="notes" maxLength={300} /></div>
              <div className="span2"><button className="btn" type="submit">{t('adv_save')}</button></div>
            </form>
            <form action={createAdvanceAccount} className="fgrid">
              <h3 className="span2" style={{ margin: 0 }}>{t('adv_new_person')}</h3>
              <div className="field"><label htmlFor="holder">{t('adv_holder')}</label><input className="input" id="holder" name="holder" required maxLength={120} /></div>
              <div className="field"><label htmlFor="advcur">{t('currency')}</label><select className="input" id="advcur" name="currency" defaultValue="MGA"><option>MGA</option><option>EUR</option></select></div>
              <div className="field"><label htmlFor="advloc">{t('place')}</label><select className="input" id="advloc" name="location" defaultValue="MG">
                <option value="MG">{t('madagascar')}</option><option value="IT">{t('italy')}</option></select></div>
              <div className="span2"><button className="btn" type="submit">{t('adv_create')}</button></div>
            </form>
          </div>
        </details>
      )}

      {/* portafoglio della persona: saldo in mano, tasti, estratto */}
      {persona && staff && (W || wAcc) && (
        <div className="sheet-bg dl-sheet-bg">
          <Link className="dl-sheet-x" href={href({})} scroll={false} aria-label={LL('Chiudi', 'Fermer')} />
          <aside className="sheet sheet-help dl-sheet aw-sheet" role="dialog" aria-modal="true" aria-label={accName(wAcc ?? W)}>
            <div className="sheet-h"><h2>{accName(wAcc ?? W)}</h2><div className="spacer" />
              <Link className="btn ghost" href={href({})} scroll={false}>{LL('Chiudi', 'Fermer')}</Link></div>
            <div className="sheet-b">
              {okText && <div className="note ok" role="status" style={{ marginBottom: 10 }}>{okText}</div>}
              {errText && <div className="note err" style={{ marginBottom: 10 }}>{errText}</div>}
              <div className="aw-top">
                <span className="muted">{wBal < 0 ? LL('Anticipato dalla persona, da rimborsare', 'Avancé par la personne, à rembourser') : LL('In mano', 'En main')}</span>
                <b className={`num ${wBal < 0 ? 'neg' : wBal > 0 ? 'pos' : ''}`}>{money(Math.abs(wBal), wCur, lang)}</b>
                {W && <small className="muted">{LL('consegnato', 'remis')} {money(W.given, wCur, lang)} · {LL('speso', 'dépensé')} {money(W.spent, wCur, lang)} · {LL('restituito', 'restitué')} {money(W.returned, wCur, lang)}</small>}
              </div>
              <div className="aw-btns">
                <Link className="btn primary" href={`/nuovo?tipo=expense&conto=${persona}`}>+ {LL('Ricevuta', 'Reçu')}</Link>
                {resp && wBal > 0 && (
                  <details className="ar-pop"><summary className="btn">{LL('Restituzione', 'Restitution')}</summary>
                    <form action={moveAdvance} className="ar-form">
                      <input type="hidden" name="client_uuid" value={randomUUID()} /><input type="hidden" name="person" value={`acc:${persona}`} />
                      <input type="hidden" name="op" value="return" /><input type="hidden" name="ret_persona" value={persona} />
                      <label className="field"><span className="flabel">{LL('In cassa', 'En caisse')}</span>
                        <select className="input" name="cash" required>{(cash ?? []).filter((a) => a.currency === wCur).map((a) => <option key={a.id} value={a.id}>{L(a)}</option>)}</select></label>
                      <label className="field"><span className="flabel">{t('amount')} ({wCur})</span>
                        <input className="input num" name="amount" inputMode="decimal" required defaultValue={num(wBal, lang)} /></label>
                      <label className="field"><span className="flabel">{t('f_op_date')}</span><input className="input" name="date" type="date" defaultValue={today} required /></label>
                      <button className="btn primary" type="submit">{LL('Registra la restituzione', 'Enregistrer la restitution')}</button>
                    </form></details>)}
                {writer && <Link className="btn" href={href({ nuova: '1', per: persona })} scroll={false}>{LL('Nuova richiesta', 'Nouvelle demande')}</Link>}
                {resp && settled && <form action={closeSettled}><input type="hidden" name="account" value={persona} />
                  <button className="btn" type="submit">{LL('Saldo a zero: chiudi', 'Solde à zéro : clôturer')}</button></form>}
              </div>

              {wOpen.length > 0 && <ul className="aw-st">{wOpen.map((r) => (
                <li key={r.id}><span className="aw-d">{date(r.requested_at.slice(0, 10))}</span><span>{LL('Richiesta', 'Demande')} · {r.purpose} {chip(r.status)}</span>
                  <b className="num muted">{money(amt(r), r.currency, lang)}</b></li>))}</ul>}

              <h3 className="aw-h">{LL('Estratto', 'Relevé')}</h3>
              {(movs ?? []).length === 0 ? <p className="muted">{LL('Ancora nessun movimento.', 'Encore aucun mouvement.')}</p> : (
                <ul className="aw-st">
                  {(movs ?? []).map((m) => {
                    const { v, label } = line(m), rq = wReqs.find((r) => r.delivery_movement_id === m.id);
                    return (
                      <li key={m.id} className={m.status === 'draft' ? 'draft' : ''}>
                        <span className="aw-d">{date(m.op_date)}</span>
                        <span><Link href={`/movimenti/${m.id}`}>{label}</Link> · {m.description ?? ''}
                          {m.kind === 'expense' && m.movement_documents.length === 0 && <span className="chip warn">{LL('senza ricevuta', 'sans reçu')}</span>}
                          {m.status === 'draft' && <span className="chip">{LL('bozza', 'brouillon')}</span>}
                          {rq && <span className="aw-rc">
                            <Link href={`/anticipi/${rq.id}`}>{LL('ricevuta di consegna', 'reçu de remise')}</Link>
                            {rq.delivery_document_id ? <> · {docLink(rq.delivery_document_id, LL('firmata ✓', 'signé ✓'))}</>
                              : resp ? <AdvanceDoc orgId={me.org_id} kind="delivery" lang={lang} reqId={rq.id} compact label={LL('Carica la ricevuta firmata', 'Charger le reçu signé')} />
                                : <span className="neg"> · {LL('da firmare', 'à signer')}</span>}</span>}
                        </span>
                        <b className={`num ${v > 0 ? 'pos' : ''}`}>{v > 0 ? '+' : '−'}{money(Math.abs(v), wCur, lang)}</b>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* nuova richiesta: chi, quanto, cosa compro, preventivo */}
      {nuova && (
        <div className="sheet-bg dl-sheet-bg">
          <Link className="dl-sheet-x" href={href({ persona: persona || undefined })} scroll={false} aria-label={LL('Chiudi', 'Fermer')} />
          <aside className="sheet sheet-help dl-sheet aw-sheet" role="dialog" aria-modal="true" aria-label={LL('Nuova richiesta', 'Nouvelle demande')}>
            <div className="sheet-h"><h2>{LL('Nuova richiesta di contanti', 'Nouvelle demande d’espèces')}</h2><div className="spacer" />
              <Link className="btn ghost" href={href({ persona: persona || undefined })} scroll={false}>{LL('Chiudi', 'Fermer')}</Link></div>
            <div className="sheet-b">
              <form action={requestAdvance} className="fgrid" id="nuova-richiesta">
                <PersonPicker id="rq-acc" label={LL('Chi riceve i contanti', 'Qui reçoit les espèces')} lang={lang} accounts={pickAcc} users={pickUsers} def={perDef} />
                <div className="field"><label htmlFor="rq-amt">{t('amount')}</label><input className="input num" id="rq-amt" name="amount" inputMode="decimal" required placeholder="0" /></div>
                <div className="field span2"><label htmlFor="rq-p">{LL('Cosa devi comprare o pagare', 'Que dois-tu acheter ou payer')}</label>
                  <input className="input" id="rq-p" name="purpose" required minLength={3} maxLength={500} placeholder={LL('Es. tessuti, filo e aghi per il laboratorio di cucito', 'Ex. tissus, fil et aiguilles pour l’atelier de couture')} /></div>
                <div className="field"><label htmlFor="rq-prj">{t('project')}</label>
                  <select className="input" id="rq-prj" name="project" defaultValue=""><option value="">–</option>{(prj ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div className="field"><label htmlFor="rq-use">{LL('Quando servono', 'Quand en as-tu besoin')}</label><input className="input" id="rq-use" name="use_date" type="date" defaultValue={today} required /></div>
                <div className="field span2"><span className="flabel">{LL('Preventivo o stima (foto o PDF)', 'Devis ou estimation (photo ou PDF)')}</span>
                  <AdvanceDoc orgId={me.org_id} kind="estimate" lang={lang} name="estimate_document_id" label={LL('Allega il preventivo', 'Joindre le devis')} /></div>
                <div className="span2 aw-sub"><button className="btn primary" type="submit">{LL('Invia la richiesta', 'Envoyer la demande')}</button>
                  <span className="muted small">{LL('Le ricevute vanno portate entro 15 giorni dall’uso.', 'Les reçus sont à apporter dans les 15 jours.')} {limits.resp || limits.admin
                    ? LL(`Autorizza il responsabile fino a ${num(limits.resp ?? 0, lang)} €, l’amministratore fino a ${num(limits.admin ?? 0, lang)} €, oltre il Consiglio.`, `Autorise le responsable jusqu’à ${num(limits.resp ?? 0, lang)} €, l’administrateur jusqu’à ${num(limits.admin ?? 0, lang)} €, au-delà le Conseil.`) : ''}</span></div>
              </form>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
