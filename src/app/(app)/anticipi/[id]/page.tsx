import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMe } from '@/lib/session';
import { date, money } from '@/lib/format';
import { Denied, PageHead } from '@/components/Page';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

type Req = { id: string; account_id: string; role_kind: string; amount: string; currency: string; amount_eur: string | null; purpose: string;
  project_id: string | null; use_date: string; report_by: string; status: string; requested_by: string; requested_at: string;
  authorized_by: string | null; authorized_at: string | null; authorized_amount: string | null; board_ref: string | null; decision_note: string | null;
  delivery_movement_id: string | null; delivered_at: string | null; reported_at: string | null; closed_by: string | null; closed_at: string | null; close_note: string | null };
type Mov = { id: string; ref: string | null; op_date: string; kind: string; amount: string; sign: number; description: string | null; account_id: string;
  to_account_id: string | null; status: string; movement_documents: { document_id: string }[] };

// Scheda dell'anticipo: i 5 passi con chi e quando, le spese registrate sul conto anticipi e il riepilogo da firmare.
// Si stampa o si salva in PDF dal browser (un documento unico con richiesta, autorizzazione, consegna, rendiconto e chiusura).
export default async function AdvanceSheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, me, t, lang } = await requireMe();
  if (!me) return <Denied text={t('only_staff')} />;
  const LL = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const { data: r } = await supabase.from('advance_requests').select('*').eq('id', id).maybeSingle<Req>();
  if (!r) notFound();
  const [{ data: acc }, { data: ppl }, { data: prj }, { data: movs }, { data: org }] = await Promise.all([
    supabase.from('accounts').select('id, holder, name_it, name_fr, currency').eq('id', r.account_id).maybeSingle(),
    supabase.from('profiles').select('id, full_name'),
    r.project_id ? supabase.from('projects').select('name').eq('id', r.project_id).maybeSingle() : Promise.resolve({ data: null }),
    r.delivered_at ? supabase.from('movements').select('id, ref, op_date, kind, amount, sign, description, account_id, to_account_id, status, movement_documents(document_id)')
      .or(`account_id.eq.${r.account_id},to_account_id.eq.${r.account_id}`).neq('status', 'draft').gte('op_date', r.delivered_at)
      .lte('op_date', r.closed_at ? r.closed_at.slice(0, 10) : '2999-12-31').order('op_date').returns<Mov[]>() : Promise.resolve({ data: [] as Mov[] }),
    supabase.from('settings').select('value').eq('key', 'org_details').maybeSingle(),
  ]);
  const holder = acc ? (acc.holder || (lang === 'fr' ? acc.name_fr || acc.name_it : acc.name_it) || '–') : '–';
  const who = new Map((ppl ?? []).map((p) => [p.id, p.full_name as string]));
  const cur = r.currency, given = Number(r.authorized_amount ?? r.amount);
  const rows = (movs ?? []).filter((m) => m.id !== r.delivery_movement_id);
  const spent = rows.filter((m) => m.kind === 'expense' && m.account_id === r.account_id).reduce((s, m) => s + Number(m.amount) * m.sign, 0);
  const back = rows.filter((m) => m.kind === 'transfer' && m.account_id === r.account_id).reduce((s, m) => s + Number(m.amount) * m.sign, 0);
  const more = rows.filter((m) => m.kind === 'transfer' && m.to_account_id === r.account_id).reduce((s, m) => s + Number(m.amount) * m.sign, 0);
  const left = given + more - spent - back;
  const noDoc = rows.filter((m) => m.kind === 'expense' && m.account_id === r.account_id && m.movement_documents.length === 0).length;
  const ente = ((org?.value ?? {}) as { legal_name?: string }).legal_name || 'YouSud ODV';
  const ROLE: Record<string, [string, string]> = { volunteer: ['volontario', 'bénévole'], employee: ['dipendente o collaboratore', 'salarié ou collaborateur'], contact: ['referente locale', 'référent local'], other: ['altro', 'autre'] };
  const dt = (s: string | null) => (s ? date(s.slice(0, 10)) : '–');
  const steps: [string, string, string, string | null, string | null][] = [
    ['s1', LL('Richiesta', 'Demande'), LL('chi chiede', 'demandeur'), who.get(r.requested_by) ?? '–', r.requested_at],
    ['s2', r.status === 'rejected' ? LL('Respinta', 'Refusée') : LL('Autorizzazione', 'Autorisation'), LL('chi autorizza', 'qui autorise'), r.authorized_by ? who.get(r.authorized_by) ?? '–' : null, r.authorized_at],
    ['s3', LL('Consegna', 'Remise'), LL('giroconto dalla cassa', 'virement depuis la caisse'), r.delivered_at ? holder : null, r.delivered_at],
    ['s4', LL('Rendiconto', 'Rapport'), LL('spese registrate e giustificativi', 'dépenses et justificatifs'), r.reported_at ? holder : null, r.reported_at],
    ['s5', LL('Chiusura', 'Clôture'), LL('residuo restituito o eccedenza rimborsata', 'reliquat restitué ou excédent remboursé'), r.closed_by ? who.get(r.closed_by) ?? '–' : null, r.closed_at],
  ];

  return (
    <div className="stack adv-sheet">
      <PageHead title={`${LL('Anticipo', 'Avance')} · ${holder}`}>
        <Link className="btn ghost no-print" href="/anticipi">← {LL('Anticipi', 'Avances')}</Link>
        <PrintButton label={LL('Stampa o salva in PDF', 'Imprimer ou enregistrer en PDF')} />
      </PageHead>

      <ol className="adv-steps tl">
        {steps.map(([c, l, sub, by, at], i) => (
          <li key={c} className={`${c}${by ? ' done' : ''}`}><span className="as-n">{by ? '✓' : i + 1}</span><b>{l}</b>
            <small>{by ? `${by} · ${dt(at)}` : sub}</small></li>))}
      </ol>

      {r.delivered_at && (
        <section className="panel doc-print adv-receipt">
          <div className="panel-b">
            <p className="muted small" style={{ marginTop: 0 }}>{ente} · {LL('Ricevuta di consegna di contanti', 'Reçu de remise d’espèces')}</p>
            <h2 style={{ margin: '4px 0 12px' }}>{LL('Ricevuta di consegna', 'Reçu de remise')}</h2>
            <p>{LL('Il/la sottoscritto/a', 'Je soussigné(e)')} <b>{holder}</b> {LL('dichiara di aver ricevuto in contanti da', 'déclare avoir reçu en espèces de')} {ente}
              {' '}{LL('la somma di', 'la somme de')} <b className="num">{money(given, cur, lang)}</b> {LL('il', 'le')} {date(r.delivered_at)}, {LL('per', 'pour')}: <b>{r.purpose}</b>{prj?.name ? ` (${prj.name})` : ''}.</p>
            <p>{LL(`Si impegna a consegnare le ricevute o fatture delle spese entro il ${date(r.report_by)} e a restituire la parte non spesa.`, `Je m’engage à remettre les reçus ou factures des dépenses avant le ${date(r.report_by)} et à restituer la partie non dépensée.`)}</p>
            <div className="sign-row">
              <div><span>{LL('Chi riceve', 'Qui reçoit')} · {holder}</span><i /></div>
              <div><span>{LL('Chi consegna', 'Qui remet')}</span><i /></div>
            </div>
          </div>
        </section>
      )}

      <section className="panel doc-print">
        <div className="panel-b">
          <p className="muted small" style={{ marginTop: 0 }}>{ente} · {LL('Scheda anticipo di cassa', 'Fiche d’avance de caisse')}</p>
          <dl className="adv-dl">
            <dt>{LL('Beneficiario', 'Bénéficiaire')}</dt><dd><b>{holder}</b> ({LL(...(ROLE[r.role_kind] ?? ROLE.other!))})</dd>
            <dt>{LL('Importo richiesto', 'Montant demandé')}</dt><dd className="num">{money(r.amount, cur, lang)}{r.amount_eur && cur !== 'EUR' ? ` (≈ ${money(r.amount_eur, 'EUR', lang)})` : ''}</dd>
            <dt>{LL('Importo autorizzato', 'Montant autorisé')}</dt><dd className="num">{r.authorized_amount ? money(r.authorized_amount, cur, lang) : '–'}</dd>
            <dt>{LL('Motivo', 'Objet')}</dt><dd>{r.purpose}{prj?.name ? ` · ${prj.name}` : ''}</dd>
            <dt>{LL('Data d’uso', 'Date d’usage')}</dt><dd>{date(r.use_date)}</dd>
            <dt>{LL('Da giustificare entro', 'À justifier avant le')}</dt><dd>{date(r.report_by)}</dd>
            {r.board_ref && <><dt>{LL('Delibera', 'Délibération')}</dt><dd>{r.board_ref}</dd></>}
            {r.decision_note && <><dt>{LL('Note', 'Notes')}</dt><dd>{r.decision_note}</dd></>}
          </dl>

          {r.delivered_at && (<>
            <h3>{LL('Rendiconto delle spese', 'Rapport des dépenses')}</h3>
            {rows.length === 0 ? <p className="muted">{LL('Nessuna spesa registrata sul conto anticipi dopo la consegna.', 'Aucune dépense saisie sur le compte d’avances après la remise.')}</p> : (
              <table className="t">
                <thead><tr><th>{t('date')}</th><th>{LL('Rif.', 'Réf.')}</th><th>{LL('Descrizione', 'Description')}</th><th className="r">{t('amount')}</th><th>{LL('Giustificativo', 'Justificatif')}</th></tr></thead>
                <tbody>{rows.map((m) => (
                  <tr key={m.id}><td className="nw">{date(m.op_date)}</td><td className="nw"><Link href={`/movimenti/${m.id}`}>{m.ref ?? '–'}</Link></td>
                    <td>{m.kind === 'transfer' ? (m.account_id === r.account_id ? LL('Restituzione', 'Restitution') : LL('Integrazione', 'Complément')) + ' · ' : ''}{m.description}</td>
                    <td className="r num">{money(Number(m.amount) * m.sign, cur, lang)}</td>
                    <td>{m.kind === 'expense' ? (m.movement_documents.length ? LL('sì', 'oui') : <span className="neg">{LL('manca', 'manquant')}</span>) : '–'}</td></tr>))}</tbody>
              </table>)}
            <dl className="adv-dl sum">
              <dt>{LL('Consegnato', 'Remis')}</dt><dd className="num">{money(given + more, cur, lang)}</dd>
              <dt>{LL('Speso', 'Dépensé')}</dt><dd className="num">{money(spent, cur, lang)}</dd>
              <dt>{LL('Restituito', 'Restitué')}</dt><dd className="num">{money(back, cur, lang)}</dd>
              <dt><b>{left >= 0 ? LL('Da restituire o giustificare', 'À restituer ou justifier') : LL('Da rimborsare alla persona', 'À rembourser à la personne')}</b></dt>
              <dd className={`num ${left !== 0 ? 'neg' : ''}`}><b>{money(Math.abs(left), cur, lang)}</b></dd>
            </dl>
            {noDoc > 0 && <p className="note warn">{LL(`${noDoc} spese senza giustificativo: allegalo o usa l’autocertificazione prima della chiusura.`, `${noDoc} dépenses sans justificatif : joignez-le ou utilisez l’auto-certification avant la clôture.`)}</p>}
          </>)}

          <div className="sign-row">
            <div><span>{LL('Il beneficiario', 'Le bénéficiaire')}</span><i /></div>
            <div><span>{LL('Chi autorizza', 'Qui autorise')}</span><i /></div>
            <div><span>{LL('Chi chiude', 'Qui clôture')}</span><i /></div>
          </div>
        </div>
      </section>
    </div>
  );
}
