import { docName } from '@/lib/doc-name';
import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { ADMIN, requireMe, RESP } from '@/lib/session';
import { date, dateTime, money, nm } from '@/lib/format';
import type { Key } from '@/lib/i18n';
import { Panel, H2 } from '@/components/Page';
import { Ico, KindIcon, StatusChip } from '@/components/Ui';
import { deleteDemoAction, discardAction, purgeAction, reverseAction, selfCertAction, signSelfCertAction, unverifyAction, verifyAction } from './actions';

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
  params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { id } = await params;
  const { ok, err } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  const { data: m } = await supabase.from('movements').select(`*,
      account:accounts!movements_account_id_fkey(name_it, name_fr, location, kind, holder),
      to_account:accounts!movements_to_account_id_fkey(name_it, name_fr, currency),
      category:categories(code, name_it, name_fr), project:projects(name), grant:grants(id, title), counterparty:counterparties(name),
      method:payment_methods(name_it, name_fr)`).eq('id', id).maybeSingle<M>();
  if (!m) notFound();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const origRef = m.reverses_id ? (await supabase.from('movements').select('ref').eq('id', m.reverses_id).maybeSingle<{ ref: string }>()).data?.ref ?? null : null;
  const [{ data: links }, { data: hist }, { data: users }, { data: rev }, { data: fe }, { data: recs }, { data: aut }] = await Promise.all([
    supabase.from('movement_documents').select('seq, document:documents(id, doc_type, original_path, pdf_path, mime, file_name, created_at)').eq('movement_id', id).order('seq'),
    supabase.rpc('movement_history', { p_id: id }),
    supabase.rpc('user_directory'),
    supabase.from('movements').select('id, ref').eq('reverses_id', id).maybeSingle(),
    supabase.from('settings').select('value').eq('key', 'four_eyes').maybeSingle(),
    // spunte nella riconciliazione bancaria (spiegano perché importo, conto e data non si modificano più)
    supabase.from('reconciliation_items').select('side, rec:bank_reconciliations(statement_date, account_id)').eq('movement_id', id),
    supabase.from('self_certs').select('id, number, declarant, declarant_role, place, reason, lang, document_id, signed_at, signed_by')
      .eq('movement_id', id).maybeSingle<{ id: string; number: string; declarant: string; declarant_role: string | null; place: string | null;
        reason: string; lang: string; document_id: string | null; signed_at: string | null; signed_by: string | null }>(),
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
  const { data: tr } = await supabase.from('movement_translations').select('source, it, fr').eq('movement_id', m.id).maybeSingle();
  // autocertificazione: per una spesa senza giustificativo (o con l'AUT già emessa), non verificata, non da chi legge soltanto
  const writer = Boolean(me && me.role !== 'read_only');
  const autPossible = m.kind === 'expense' && !m.reverses_id && !rev;
  const showAut = autPossible && (Boolean(aut) || (writer && m.status !== 'verified' && docs.length === 0));
  const autDefaultLang = aut?.lang ?? (m.account?.location === 'MG' || m.currency === 'MGA' ? 'both' : 'it');
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
      {ok && <div className="note ok" role="status"><Ico name="verified" />{ok === 'verified' ? t('verify_done')
        : ok === 'new' ? `${m.status === 'draft' ? L('Bozza salvata', 'Brouillon enregistré') : L('Movimento registrato', 'Mouvement comptabilisé')}: ${m.ref ?? ''}.`
        : ok === 'saved' ? L('Modifiche salvate.', 'Modifications enregistrées.')
        : ok === 'reversed' ? L(`Storno registrato: ${m.ref} annulla ${origRef ?? 'il movimento originale'}. Va verificato da un'altra persona.`, `Extourne comptabilisée : ${m.ref} annule ${origRef ?? 'le mouvement d’origine'}. Elle doit être vérifiée par une autre personne.`) : ok === 'aut' ? t('aut_done') : ok === 'aut_signed' ? t('aut_signed_done') : ok === 'reopened' ? (lang === 'fr' ? 'Vérification rouverte : vous pouvez corriger le mouvement.' : 'Verifica riaperta: ora puoi correggere il movimento.') : ''}</div>}
      {ok === 'new' && <div className="row-btns eq after-new"><Link className="btn" href={m.kind === 'transfer' ? '/nuovo' : `/nuovo?tipo=${m.kind}`}>{L('Registrane un altro', 'En saisir un autre')}</Link><Link className="btn" href="/movimenti">{L('Torna al registro', 'Retour au registre')}</Link></div>}
      {errText && <div className="note err">{errText}</div>}

      <div className="detail">
        <div className="detail-main stack">
          <section className="panel mv-sum">
            <div className="mv-amt">
              <span className="l">{t('amount')}</span>
              {/* euro in evidenza con il segno; sotto l'importo nella valuta del conto (quello scritto sulla ricevuta) e il tasso */}
              <span className={`v num ${signedAmount < 0 ? '' : m.kind === 'income' ? 'pos' : ''}`}>{m.currency === 'MGA' && m.amount_eur ? money(Number(m.amount_eur) * Math.sign(signedAmount || 1), 'EUR', lang) : money(signedAmount, m.currency, lang)}</span>
              {m.currency === 'MGA' && m.amount_eur && <span className="s num"><b>{money(signedAmount, m.currency, lang)}</b> · {t('f_rate')} {money(m.fx_rate, 'MGA', lang).replace(/\s?MGA$/, '')}</span>}
            </div>
            <div className="panel-b">
              <dl className="kv">
                {row(t('f_op_date'), date(m.op_date))}
                {row(t('description'), m.description || null)}
                {tr && tr.source === m.description && (lang === 'fr' ? tr.fr : tr.it) !== m.description &&
                  row(lang === 'fr' ? 'Traduction (IA)' : 'Traduzione (AI)', lang === 'fr' ? tr.fr : tr.it)}
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
          {m.demo && resp && m.status !== 'draft' && !rev && (
            <form action={deleteDemoAction} className="note mv-demo">
              <input type="hidden" name="id" value={m.id} />
              <span>{lang === 'fr' ? 'Mouvement de démonstration (DEMO) : il peut être supprimé.' : 'Movimento dimostrativo (DEMO): si può eliminare.'}</span>
              <label className="check"><input type="checkbox" name="confirm" required /> {lang === 'fr' ? `Je confirme la suppression de ${m.ref ?? 'ce mouvement'}` : `Confermo l'eliminazione di ${m.ref ?? 'questo movimento'}`}</label>
              <button className="btn" type="submit">{lang === 'fr' ? 'Supprimer' : 'Elimina'}</button>
            </form>
          )}
          {canReopen && (
            <details className="danger-zone reopen" id="riapri">
              <summary className="btn">{FR ? 'Corriger ce mouvement…' : 'Correggi questo movimento…'}</summary>
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
                    <li key={d.id}>
                      {/* anteprima dentro l'app: chi verifica guarda la ricevuta senza uscire (revisione 14/11) */}
                      {signed[i]?.open && (/^image\//.test(d.mime) && !d.pdf_path
                        ? <a className="doc-prev" href={signed[i].open} target="_blank" rel="noreferrer"><img src={signed[i].open} alt={`${t('f_doc')}: ${d.name}`} loading="lazy" /></a>
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
                  {!aut.signed_at && resp && (
                    <form action={signSelfCertAction}>
                      <input type="hidden" name="id" value={m.id} /><input type="hidden" name="aut" value={aut.id} />
                      <button className="btn" type="submit"><Ico name="check" />{t('aut_sign_btn')}</button>
                    </form>
                  )}
                  <p className="hint" style={{ margin: 0 }}>{t('aut_check')}</p>
                </div>
              ) : writer && m.status !== 'verified' ? (
                <form action={selfCertAction} className="aut-box">
                  <p className="muted" style={{ margin: 0 }}>{t('aut_intro')}</p>
                  <input type="hidden" name="id" value={m.id} />
                  <div className="field"><label htmlFor="aut-decl">{t('aut_declarant')}</label>
                    <input className="input" id="aut-decl" name="declarant" required maxLength={120}
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
                  <p className="hint" style={{ margin: 0 }}>{t('aut_data')} {t('aut_check')}</p>
                  <div><button className="btn primary" type="submit"><Ico name="download" />{t('aut_create')}</button></div>
                </form>
              ) : null}
            </Panel>
          )}

          {writer && !m.reverses_id && m.kind !== 'transfer' && (
            <Panel title={t('gen_docs')} pad>
              <div className="gen-docs">
                {(m.kind === 'income' ? ['RIC', 'NDD'] : ['QUI', 'NOT', 'NRS']).map((k) => (
                  <Link key={k} className="btn small" href={`/documenti-emessi/nuovo?tipo=${k}&mov=${m.id}`}>{t(`gen_${k}` as Key)}</Link>
                ))}
              </div>
            </Panel>
          )}

          {canReverse && (
            <details className="panel">
              <summary className="panel-h" style={{ cursor: 'pointer' }}><H2 text={t('d_reverse')} /></summary>
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
            <ul className="hist">
              {((hist ?? []) as H[]).map((h, i) => {
                const changed = h.action === 'update' && h.old_row && h.new_row
                  ? Object.keys(h.new_row).filter((k) => !SKIP.has(k) && JSON.stringify(h.new_row![k]) !== JSON.stringify(h.old_row![k]))
                  : [];
                return (
                  <li key={i}>
                    <span className="h-who">{h.actor ? name.get(h.actor) ?? '–' : '–'}</span>
                    <span className="h-at">{dateTime(h.at, lang)}</span>
                    <span className="h-what">{t(`a_${h.action}` as Key)}{changed.length > 0 && <span className="muted"> · {[...new Set(changed.map((k) => (FIELD[k] ? t(FIELD[k]) : k)))].join(', ')}</span>}</span>
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
