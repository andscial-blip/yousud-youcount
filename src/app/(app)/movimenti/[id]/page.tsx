import { prjName } from '@/lib/project-theme';
import { PendingButton } from '@/components/PendingButton';
import { docName } from '@/lib/doc-name';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { ADMIN, requireMe, RESP } from '@/lib/session';
import { date, dateTime, money, nm, rate as fxRate, noDocReason, nbRef } from '@/lib/format';
import type { Key } from '@/lib/i18n';
import { Panel, H2 } from '@/components/Page';
import { Ico, KindIcon, StatusChip } from '@/components/Ui';
import { deleteDemoAction, discardAction, purgeAction, reverseAction, selfCertAction, signSelfCertAction, unverifyAction, verifyAction, reportErrorAction } from './actions';

export const dynamic = 'force-dynamic';

type N = { name_it: string; name_fr: string } | null;
type M = { demo?: boolean;
  id: string; ref: string | null; kind: 'income' | 'expense' | 'transfer'; status: 'draft' | 'recorded' | 'verified';
  op_date: string; doc_date: string | null; description: string; amount: string; currency: string; fx_rate: string | null;
  amount_eur: string | null; to_amount: string | null; notes: string | null; no_doc_reason: string | null;
  reverses_id: string | null; reversal_reason: string | null; version: number; ai_extracted: boolean;
  created_by: string; created_at: string; recorded_by: string | null; recorded_at: string | null;
  verified_by: string | null; verified_at: string | null;
  paid_by: string | null; reimb_status: 'due' | 'paid' | null; reimbursed_at: string | null; reimbursed_by: string | null;
  account: (N & { location: string; kind: string; holder: string | null }) | null; to_account: (N & { currency: string }) | null; category: (N & { code: string }) | null;
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
  params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string; aut?: string }>;
}) {
  const { id } = await params;
  const { ok, err, aut: autQ } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  const { data: m } = await supabase.from('movements').select(`*,
      account:accounts!movements_account_id_fkey(name_it, name_fr, location, kind, holder),
      to_account:accounts!movements_to_account_id_fkey(name_it, name_fr, currency),
      category:categories(code, name_it, name_fr), project:projects(name), grant:grants(id, title), counterparty:counterparties(name),
      method:payment_methods(name_it, name_fr)`).eq('id', id).maybeSingle<M>();
  if (!m) notFound();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  // velocità (16/11): tutte le letture che dipendono solo dal movimento partono insieme (prima tre erano in fila)
  const [{ data: links }, { data: hist }, { data: users }, { data: rev }, { data: fe }, { data: recs }, { data: aut }, { data: orig }, { data: tr }, { data: reports }] = await Promise.all([
    supabase.from('movement_documents').select('seq, document:documents(id, doc_type, original_path, enhanced_path, pdf_path, mime, file_name, created_at)').eq('movement_id', id).order('seq'),
    supabase.rpc('movement_history', { p_id: id }),
    supabase.rpc('user_directory'),
    supabase.from('movements').select('id, ref').eq('reverses_id', id).maybeSingle(),
    supabase.from('settings').select('value').eq('key', 'four_eyes').maybeSingle(),
    // spunte nella riconciliazione bancaria (spiegano perché importo, conto e data non si modificano più)
    supabase.from('reconciliation_items').select('side, rec:bank_reconciliations(statement_date, account_id)').eq('movement_id', id),
    supabase.from('self_certs').select('id, number, declarant, declarant_role, place, reason, lang, document_id, signed_at, signed_by')
      .eq('movement_id', id).maybeSingle<{ id: string; number: string; declarant: string; declarant_role: string | null; place: string | null;
        reason: string; lang: string; document_id: string | null; signed_at: string | null; signed_by: string | null }>(),
    m.reverses_id ? supabase.from('movements').select('ref').eq('id', m.reverses_id).maybeSingle<{ ref: string }>() : Promise.resolve({ data: null }),
    supabase.from('movement_translations').select('source, it, fr').eq('movement_id', m.id).maybeSingle(),
    supabase.from('deadlines').select('id, notes, status, created_at, done_at').eq('movement_id', m.id).order('created_at', { ascending: false }),
  ]);
  const origRef = (orig as { ref: string } | null)?.ref ?? null;
  const recDates = ((recs ?? []) as unknown as { side: string; rec: { statement_date: string } | null }[])
    .map((r) => r.rec?.statement_date).filter(Boolean) as string[];
  const name = new Map(((users ?? []) as { id: string; full_name: string }[]).map((u) => [u.id, u.full_name]));
  type D = { id: string; original_path: string; enhanced_path?: string | null; pdf_path: string | null; mime: string; file_name: string | null; created_at: string };
  const docs = ((links ?? []) as unknown as { seq: number; document: D | null }[])
    .filter((l) => l.document)
    .map((l) => {
      const path = l.document!.pdf_path ?? l.document!.enhanced_path ?? l.document!.original_path;
      return { ...l.document!, path, name: docName(m.ref, l.seq, path, l.document!.file_name) };
    });
  const bucket = supabase.storage.from('documents');
  // i due collegamenti di ogni file insieme, non uno dopo l'altro
  // foto: l'anteprima mostra l'immagine originale anche quando esiste il PDF (su telefono il PDF incorporato non si vede)
  const signed = await Promise.all(docs.map(async (d) => { const isImg = /^image\//.test(d.mime);
    const [o, sv, im] = await Promise.all([bucket.createSignedUrl(d.path, 600), bucket.createSignedUrl(d.path, 600, { download: d.name }),
      isImg && d.pdf_path ? bucket.createSignedUrl(d.original_path, 600) : Promise.resolve({ data: null })]);
    return { open: o.data?.signedUrl, save: sv.data?.signedUrl, img: isImg ? (im.data?.signedUrl ?? o.data?.signedUrl) : undefined }; }));
  const resp = me && RESP.includes(me.role);
  const strict = fe?.value !== false;
  // il super amministratore verifica anche i propri movimenti; per gli altri vale «quattro occhi»
  const canVerify = resp && m.status === 'recorded' && !rev && !(strict && me!.role !== 'super_admin' && (m.created_by === me!.id || m.recorded_by === me!.id));
  const canReverse = resp && m.status !== 'draft' && !m.reverses_id && !rev;
  // uno storno nasce bloccato: non si modifica (prima della verifica si elimina e si rifà)
  const canEdit = !rev && !m.reverses_id && (m.status === 'draft' ? (m.created_by === me!.id || resp) : m.status === 'recorded' && resp);
  const admin = Boolean(me && ADMIN.includes(me.role));
  // verificato: per correggerlo un amministratore ne riapre la verifica (con motivo); poi si modifica e si riverifica
  // regola unica: dopo la verifica si corregge con lo storno; riaprire o eliminare resta al solo super amministratore
  const superAdmin = me?.role === 'super_admin';
  const canReopen = superAdmin && m.status === 'verified' && !rev && !m.reverses_id;
  const FR = lang === 'fr';
  // autocertificazione: per una spesa senza giustificativo (o con l'AUT già emessa), non verificata, non da chi legge soltanto
  const writer = Boolean(me && me.role !== 'read_only');
  const autPossible = m.kind === 'expense' && !m.reverses_id && !rev;
  const autNow = autQ === '1';   // arrivo da «Registra» con la scelta «prepara l'autocertificazione»
  // il modulo si prepara su una spesa registrata, da chi l'ha inserita o da un responsabile (revisione 21/11: non sulle bozze né sulle spese altrui)
  const canAut = writer && (m.status === 'recorded' || (m.status === 'draft' && m.reimb_status === 'due')) && (resp || m.created_by === me!.id);   // O2 (giro 12): anche la spesa di tasca propria da rimborsare
  const showAut = autPossible && (Boolean(aut) || (canAut && docs.length === 0));
  const autDefaultLang = aut?.lang ?? (m.account?.location === 'MG' || m.currency === 'MGA' ? 'both' : 'it');
  const signedAmount = m.kind === 'transfer' ? Number(m.amount) : Number(m.amount) * (m.reverses_id ? -1 : 1) * (m.kind === 'income' ? 1 : -1);
  const errText = err ? (t(`err_${err.split(':')[0]}` as Key) ?? err) : null;

  const row = (label: string, value: React.ReactNode) => (<><dt>{label}</dt><dd>{value ?? '–'}</dd></>);
  return (
    <div className="stack">
      <div className="h1row">
        <KindIcon kind={m.kind} label={t(`k_${m.kind}`)} />
        <h1>{m.ref ?? (m.reimb_status === 'due' ? L('Da rimborsare', 'À rembourser') : t('st_draft'))} · {m.reverses_id ? L(`Storno di ${t(`k_${m.kind}`).toLowerCase()}`, `Extourne de ${t(`k_${m.kind}`).toLowerCase()}`) : t(`k_${m.kind}`)}</h1>
        {m.reimb_status === 'due' ? <span className="chip ichip pend"><Ico name="wallet" size={14} />{L('Da rimborsare', 'À rembourser')}</span> : <StatusChip s={m.status} label={t(`st_${m.status}`)} />}
        {rev && <Link className="chip ichip err" href={`/movimenti/${rev.id}`}><Ico name="reversed" size={14} />{t('d_reversed_by')} {rev.ref}</Link>}
      </div>
      {ok && <div className="note ok" role="status"><Ico name="verified" />{ok === 'verified' ? t('verify_done')
        : ok === 'new' ? (m.reimb_status === 'due' ? L('Spesa salvata: la rimborserà un responsabile. La trovi in «Da rimborsare».', 'Dépense enregistrée : un responsable la remboursera. Vous la trouvez dans « À rembourser ».')
          : m.status === 'draft' ? <>{L('Bozza salvata: non conta ancora nei saldi. Per completarla tocca «Modifica», poi «Registra».', 'Brouillon enregistré : il ne compte pas encore dans les soldes. Pour le compléter, touchez « Modifier », puis « Comptabiliser ».')}
              {canEdit && <> <Link className="btn sm" href={`/movimenti/${m.id}/modifica`}>{t('d_edit')}</Link></>}</>
          : `${L('Movimento registrato:', 'Mouvement comptabilisé\u00a0:')} ${m.ref}. ${L('Ora lo controlla un responsabile.', 'Un responsable va maintenant le contrôler.')}`)
        : ok === 'saved' ? L('Modifiche salvate.', 'Modifications enregistrées.')
        : ok === 'reversed' ? L(`Storno registrato: ${m.ref} annulla ${origRef ?? 'il movimento originale'}. Va verificato da un'altra persona.`, `Extourne comptabilisée : ${m.ref} annule ${origRef ?? 'le mouvement d’origine'}. Elle doit être vérifiée par une autre personne.`) : ok === 'reported' ? L('Segnalazione inviata ai responsabili.', 'Signalement envoyé aux responsables.') : ok === 'aut' ? t('aut_done') : ok === 'aut_signed' ? t('aut_signed_done') : ok === 'reopened' ? (lang === 'fr' ? 'Vérification rouverte : vous pouvez corriger le mouvement.' : 'Verifica riaperta: ora puoi correggere il movimento.') : ''}</div>}
      {/* dopo lo storno: la copia corretta riparte da dati e allegati dell'originale (P2-15) */}
      {writer && m.kind !== 'transfer' && (rev || (m.reverses_id && ok === 'reversed')) && (
        <div className="row-btns eq after-new"><Link className="btn" href={`/nuovo?copia=${rev ? m.id : m.reverses_id}`}>{L('Crea la copia corretta', 'Créer la copie corrigée')}</Link></div>)}
      {ok === 'new' && <div className="row-btns eq after-new"><Link className="btn" href={m.kind === 'transfer' ? '/nuovo' : `/nuovo?tipo=${m.kind}`}>{L('Registrane un altro', 'En saisir un autre')}</Link><Link className="btn" href="/movimenti">{L('Torna al registro', 'Retour au registre')}</Link></div>}
      {errText && <div className="note err">{errText}</div>}

      <div className="detail">
        <div className="detail-main stack">
          <section className="panel mv-sum">
            <div className="mv-amt">
              <span className="l">{t('amount')}</span>
              {/* euro in evidenza con il segno; sotto l'importo nella valuta del conto (quello scritto sulla ricevuta) e il tasso */}
              <span className={`v num ${m.kind === 'income' && signedAmount > 0 ? 'amt-in' : ''}`}>{m.kind === 'income' && signedAmount > 0 ? '+' : ''}{m.currency === 'MGA' && m.amount_eur ? money(Number(m.amount_eur) * Math.sign(signedAmount || 1), 'EUR', lang) : money(signedAmount, m.currency, lang)}</span>
              {m.currency === 'MGA' && m.amount_eur && <span className="s num"><b>{money(signedAmount, m.currency, lang)}</b> · {t('f_rate')} {fxRate(m.fx_rate, lang, false)}</span>}
            </div>
            <div className="panel-b">
              <dl className="kv">
                {row(t('f_op_date'), date(m.op_date))}
                {row(t('description'), m.description || null)}
                {tr && tr.source === m.description && (lang === 'fr' ? tr.fr : tr.it) !== m.description &&
                  row(lang === 'fr' ? 'Traduction (IA)' : 'Traduzione (AI)', lang === 'fr' ? tr.fr : tr.it)}
                {m.reimb_status === 'due' ? row(t('account'), <span className="chip ichip pend"><Ico name="wallet" size={14} />{t('reimb_due_chip')}</span>)
                : row(m.kind === 'transfer' ? t('f_from_account') : t('account'), nm(lang, m.account))}
                {m.paid_by && row(t('f_paid_by'), m.paid_by)}
                {m.reimb_status === 'paid' && m.reimbursed_at && row(t('reimb_done_row'), `${date(m.op_date)} · ${name.get(m.reimbursed_by ?? '') ?? '–'}`)}
                {m.kind === 'transfer' && row(t('f_to_account'), `${nm(lang, m.to_account)} · ${money(m.to_amount, m.to_account?.currency ?? m.currency, lang)}`)}
                {m.category && row(t('f_category'), `${m.category.code} · ${nm(lang, m.category)}`)}
                {m.kind !== 'transfer' && row(t('project'), m.project?.name ? prjName(m.project.name, lang) : m.project?.name)}
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
          {m.demo && resp && m.status !== 'draft' && !rev && (
            <form action={deleteDemoAction} className="note mv-demo">
              <input type="hidden" name="id" value={m.id} />
              <span>{lang === 'fr' ? 'Mouvement de démonstration (DEMO) : il peut être supprimé.' : 'Movimento dimostrativo (DEMO): si può eliminare.'}</span>
              <label className="check"><input type="checkbox" name="confirm" required /> {lang === 'fr' ? `Je confirme la suppression de ${m.ref ? nbRef(m.ref) : 'ce mouvement'}` : `Confermo l'eliminazione di ${m.ref ? nbRef(m.ref) : 'questo movimento'}`}</label>
              <button className="btn" type="submit">{lang === 'fr' ? 'Supprimer' : 'Elimina'}</button>
            </form>
          )}
          {/* chi ha inserito il movimento ma non può più toccarlo sa a chi rivolgersi (revisione finale del 15/11) */}
          {/* U1 (giro 17): l'avviso «chiedi a un responsabile» non serve più: lo fa il modulo «Segnala al responsabile» qui sotto */}
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
                  <button className="btn ghost" type="submit" style={{ color: 'var(--red)' }}>{m.reimb_status === 'due' ? L('Elimina la spesa', 'Supprimer la dépense') : t('d_discard')}</button>
                </form>
              )}
            </div>
          )}
          {superAdmin && !m.demo && m.status !== 'draft' && (
            <details className="danger-zone" id="elimina">
              <summary className="btn ghost">{FR ? 'Supprimer définitivement…' : 'Elimina definitivamente…'}</summary>
              <form action={purgeAction} className="stack" style={{ gap: 8, marginTop: 10 }}>
                <input type="hidden" name="id" value={m.id} />
                <p className="muted" style={{ margin: 0 }}>{FR
                  ? 'En comptabilité, on corrige normalement par une extourne. La suppression définitive retire le mouvement (et son éventuelle extourne) des soldes et des rapports ; ses données restent dans le journal des modifications.'
                  : 'In contabilità di norma si corregge con lo storno. L\'eliminazione definitiva toglie il movimento (e il suo eventuale storno) da saldi e report; i suoi dati restano nel registro modifiche.'}</p>
                <label className="field"><span>{FR ? 'Motif' : 'Motivo'}</span>
                  <input className="input" name="reason" required minLength={5} maxLength={300} placeholder={FR ? 'Ex. saisi deux fois' : 'Es. inserito due volte'} /></label>
                <label className="field"><span>{FR ? 'Votre mot de passe' : 'La tua password'}</span>
                  <input className="input" name="password" type="password" required autoComplete="current-password" /></label>
                <label className="check"><input type="checkbox" name="confirm" required /> {FR ? `Je supprime définitivement ${m.ref ?? 'ce mouvement'}` : `Elimino definitivamente ${m.ref ?? 'questo movimento'}`}</label>
                <div><button className="btn danger" type="submit">{FR ? 'Supprimer définitivement' : 'Elimina definitivamente'}</button></div>
              </form>
            </details>
          )}
        </div>
        <aside className="detail-side stack">
          {(m.kind !== 'transfer' || docs.length > 0) && (
            <Panel title={t('d_documents')} pad>
              {docs.length === 0 ? <p className="muted" style={{ margin: 0 }}>{m.no_doc_reason ? `${t('d_no_reason')}${lang === 'fr' ? '\u00a0' : ''}: ${noDocReason(m.no_doc_reason, lang)}` : canEdit ? <>{L('Nessun giustificativo. Per aggiungerlo tocca «Modifica» e fotografa lo scontrino.', 'Aucun justificatif. Pour l’ajouter, touchez « Modifier » et photographiez le ticket.')} <Link href={`/movimenti/${m.id}/modifica`}>{L('Modifica', 'Modifier')}</Link></> : L('Nessun giustificativo.', 'Aucun justificatif.')}</p> : (
                <ul className="docs">
                  {docs.map((d, i) => (
                    <li key={d.id}>
                      {/* anteprima dentro l'app: chi verifica guarda la ricevuta senza uscire (revisione 14/11) */}
                      {signed[i]?.open && (signed[i].img
                        ? <a className="doc-prev" href={signed[i].open} target="_blank" rel="noreferrer"><img src={signed[i].img} alt={`${t('f_doc')}: ${d.name}`} loading="lazy" /></a>
                        : <object className="doc-prev pdf" data={`${signed[i].open}#toolbar=0&view=FitH`} type="application/pdf" aria-label={`${t('f_doc')}: ${d.name}`}><span className="muted small">{lang === 'fr' ? 'Aperçu non disponible : utilisez « Ouvrir ».' : 'Anteprima non disponibile: usa «Apri».'}</span></object>)}
                      <span className="num">{d.name}</span>
                      {signed[i]?.open ? <a className="btn" href={signed[i].open} target="_blank" rel="noreferrer">{t('d_open')}</a> : null}
                      {signed[i]?.save ? <a className="btn ghost" href={signed[i].save} title={d.name}><Ico name="download" />{t('d_download')}</a> : null}</li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {showAut && (
            <Panel title={aut ? `${t('aut_title')} · ${aut.number}` : t('aut_title')} pad>
              {aut?.document_id ? (
                <div className="aut-box">
                  <p style={{ margin: 0 }}>{aut.declarant}{aut.declarant_role ? ` · ${aut.declarant_role}` : ''}{' '}
                    <span className={`chip ${aut.signed_at ? 'ok' : 'warn'}`}>{aut.signed_at ? t('aut_signed') : t('aut_to_sign')}</span></p>
                  {aut.signed_at && <p className="muted" style={{ margin: 0 }}>{t('aut_signed_by')}: {name.get(aut.signed_by ?? '') ?? '–'} · {dateTime(aut.signed_at, lang)}</p>}
                  {!aut.signed_at && !resp && <div className="note info" role="status">{L('Cosa fare ora: apri il PDF dell’autocertificazione, stampalo, fallo firmare a chi ha fatto la spesa e consegnalo al responsabile. La firma la registra lui in YouCount.',
                    'Que faire maintenant : ouvrez le PDF de l’attestation, imprimez-le, faites-le signer par la personne qui a fait la dépense et remettez-le au responsable. C’est lui qui enregistre la signature dans YouCount.')}</div>}
                  {(() => { const k = docs.findIndex((d) => d.id === aut.document_id); return k >= 0 && signed[k]?.open
                    ? <div className="row-btns"><a className="btn primary" href={signed[k]!.open!} target="_blank" rel="noreferrer"><Ico name="print" />{L('Apri il PDF da stampare', 'Ouvrir le PDF à imprimer')}</a></div> : null; })()}
                  {!aut.signed_at && resp && (
                    <form action={signSelfCertAction}>
                      <input type="hidden" name="id" value={m.id} /><input type="hidden" name="aut" value={aut.id} />
                      <button className="btn" type="submit"><Ico name="check" />{t('aut_sign_btn')}</button>
                    </form>
                  )}
                  {resp && <p className="hint" style={{ margin: 0 }}>{t('aut_check')}</p>}
                </div>
              ) : canAut ? (
                <form action={selfCertAction} className="aut-box">
                  {autNow && <div className="note info" role="status">{t('aut_now')}</div>}
                  <p className="muted" style={{ margin: 0 }}>{t('aut_intro')}</p>
                  <input type="hidden" name="id" value={m.id} />
                  <div className="field"><label htmlFor="aut-decl">{t('aut_declarant')}</label>
                    <input className="input" id="aut-decl" name="declarant" required maxLength={120} autoFocus={autNow}
                           defaultValue={aut?.declarant ?? m.paid_by ?? m.account?.holder ?? ''} /></div>
                  <div className="field"><label htmlFor="aut-role">{t('aut_role')}</label>
                    <input className="input" id="aut-role" name="declarant_role" maxLength={120} defaultValue={aut?.declarant_role ?? ''} /></div>
                  <div className="field"><label htmlFor="aut-place">{t('aut_place')}</label>
                    <input className="input" id="aut-place" name="place" maxLength={120} defaultValue={aut?.place ?? ''} /></div>
                  <div className="field"><label htmlFor="aut-reason">{t('aut_reason')}</label>
                    <textarea className="input" id="aut-reason" name="reason" required minLength={5} maxLength={500} rows={2}
                              defaultValue={aut?.reason ?? m.no_doc_reason ?? ''} /></div>
                  <div className="field"><span className="flabel" id="aut-lang">{t('aut_lang')}</span>
                    <div className="seg" role="radiogroup" aria-labelledby="aut-lang">
                      {(['it', 'fr', 'both'] as const).map((l) => (
                        <label key={l}><input type="radio" name="lang" value={l} defaultChecked={autDefaultLang === l} /> {t(`aut_lang_${l}`)}</label>
                      ))}
                    </div></div>
                  <p className="hint" style={{ margin: 0 }}>{t('aut_data')}{resp ? ` ${t('aut_check')}` : ''}</p>
                  <div><button className="btn primary" type="submit"><Ico name="download" />{t('aut_create')}</button></div>
                </form>
              ) : null}
            </Panel>
          )}

          {resp && ((reports ?? []) as { id: string; notes: string | null; status: string; created_at: string }[]).filter((r) => r.status === 'open').map((r) => (
            <div key={r.id} className="note warn" role="status"><b>{L(`Errore segnalato il ${date(r.created_at.slice(0, 10))}`, `Erreur signalée le ${date(r.created_at.slice(0, 10))}`)}</b>
              {r.notes && <div>«{r.notes}»</div>}<div className="hint">{L('Dopo la correzione, segna la scadenza «Fatta» in Scadenze.', 'Après la correction, marquez l’échéance « Faite » dans Échéances.')} <a href="/scadenze">{L('Apri Scadenze', 'Ouvrir Échéances')}</a></div></div>))}
          {/* chi non può correggere un movimento già registrato lo segnala a un responsabile */}
          {!resp && writer && m.status !== 'draft' && !rev && (
            <Panel title={L('Hai trovato un errore?', 'Vous avez trouvé une erreur ?')} pad>
              {((reports ?? []) as { id: string; notes: string | null; status: string; created_at: string; done_at: string | null }[]).map((r) => (
                <div key={r.id} className={`note ${r.status === 'done' ? 'ok' : 'info'}`} style={{ marginBottom: 10 }}>
                  <b>{r.status === 'done' ? L(`Corretto il ${date((r.done_at ?? r.created_at).slice(0, 10))}`, `Corrigé le ${date((r.done_at ?? r.created_at).slice(0, 10))}`) : L(`Segnalato il ${date(r.created_at.slice(0, 10))}, in attesa del responsabile`, `Signalé le ${date(r.created_at.slice(0, 10))}, en attente du responsable`)}</b>
                  {r.notes && <div>«{r.notes}»</div>}</div>))}
              {/* R5 (giro 14): con una segnalazione già aperta il modulo si apre solo su richiesta (niente doppioni per errore) */}
              {(() => { const openRep = ((reports ?? []) as { status: string }[]).some((r) => r.status !== 'done'); const form = (
              <form action={reportErrorAction} className="stack" id="segnala" style={{ gap: 8 }}>
                <input type="hidden" name="id" value={m.id} /><input type="hidden" name="ref" value={m.ref ?? ''} /><input type="hidden" name="lang" value={lang} />
                <label className="field"><span className="flabel">{L('Cosa è sbagliato (importo, data, codice…)', 'Ce qui ne va pas (montant, date, code…)')}</span>
                  <textarea className="input" name="what" rows={2} minLength={5} maxLength={900} required /></label>
                <div className="row-btns"><PendingButton className="btn" busy={L('Invio…', 'Envoi…')}>{L('Segnala al responsabile', 'Signaler au responsable')}</PendingButton></div>
                <p className="hint" style={{ margin: 0 }}>{L('La segnalazione arriva ai responsabili in «Da fare» e in Scadenze: la correggono loro.', 'Le signalement arrive aux responsables dans « À faire » et dans Échéances : ce sont eux qui corrigent.')}</p>
              </form>
              ); return openRep ? <details className="rep-more"><summary className="btn small ghost">{L('Aggiungi un dettaglio alla segnalazione', 'Ajouter un détail au signalement')}</summary>{form}</details> : form; })()}
            </Panel>
          )}

          {writer && me!.role !== 'operator' && !m.reverses_id && m.kind !== 'transfer' && (
            <Panel title={t('gen_docs')} pad>
              <div className="gen-docs">
                {(m.kind === 'income' ? ['RIC', 'NDD'] : ['QUI', 'NOT', 'NRS']).map((k) => (
                  <Link key={k} className="btn small" href={`/documenti-emessi/nuovo?tipo=${k}&mov=${m.id}`}>{t(`gen_${k}` as Key)}</Link>
                ))}
              </div>
            </Panel>
          )}

          {(canReverse || canReopen) && (   /* M5 (giro 17): Storna e Correggi nello stesso riquadro «Correzioni» */
            <section className="panel corr-p">
              <div className="panel-h"><H2 text={L('Correzioni', 'Corrections')} /></div>
              <div className="panel-b stack" style={{ gap: 10 }}>
                {canReverse && (
                  <details className="corr-d" id="storna">
                    <summary className="btn small">{FR ? 'Extourner ce mouvement…' : 'Storna questo movimento…'}</summary>
                    <form action={reverseAction} className="stack" style={{ gap: 10, marginTop: 10 }}>
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
                {canReopen && (
                  <details className="danger-zone reopen corr-d" id="riapri">
                    <summary className="btn small">{FR ? 'Corriger ce mouvement…' : 'Correggi questo movimento…'}</summary>
                    <form action={unverifyAction} className="stack" style={{ gap: 8, marginTop: 10 }}>
                      <input type="hidden" name="id" value={m.id} />
                      <p className="muted" style={{ margin: 0 }}>{FR
                        ? 'Le mouvement est vérifié : pour le corriger, sa vérification est rouverte (il redevient « enregistré »), puis il faudra le vérifier à nouveau. Le motif reste dans les notes et l\'historique.'
                        : 'Il movimento è verificato: per correggerlo se ne riapre la verifica (torna «registrato»), poi andrà verificato di nuovo. Il motivo resta nelle note e nello storico.'}</p>
                      <label className="field"><span>{FR ? 'Motif' : 'Motivo'}</span>
                        <input className="input" name="reason" required minLength={5} maxLength={300} placeholder={FR ? 'Ex. code comptable erroné' : 'Es. codice contabile sbagliato'} /></label>
                      <div><button className="btn" type="submit">{FR ? 'Rouvrir et corriger' : 'Riapri e correggi'}</button></div>
                    </form>
                  </details>
                )}
              </div>
            </section>
          )}

          <Panel title={t('d_history')}>
            <ul className="hist">
              {((hist ?? []) as H[]).map((h, i) => {
                const changed = h.action === 'update' && h.old_row && h.new_row
                  ? Object.keys(h.new_row).filter((k) => !SKIP.has(k) && JSON.stringify(h.new_row![k]) !== JSON.stringify(h.old_row![k]))
                  : [];
                return (
                  <li key={i}>
                    <span className="h-who">{h.actor ? name.get(h.actor) ?? '–' : '–'}</span>
                    <span className="h-at">{dateTime(h.at, lang)}</span>
                    <span className="h-what">{t(`a_${h.action}` as Key)}{changed.some((k) => FIELD[k]) && <span className="muted"> · {[...new Set(changed.filter((k) => FIELD[k]).map((k) => t(FIELD[k]!)))].join(', ')}</span>}</span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
