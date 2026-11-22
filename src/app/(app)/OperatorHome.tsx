import { Ico, StatusChip, EmptyState } from '@/components/Ui';
import { orgNow } from '@/lib/today';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Lang, T } from '@/lib/i18n';
import type { Me } from '@/lib/session';
import { date, money } from '@/lib/format';
import { CIcon } from '@/components/CIcon';
import { H2 } from '@/components/Page';
import { DashNotes } from '@/components/DashNotes';

// Dashboard dell'operatore (revisione del 16/11): solo ciò che riguarda chi la apre — contanti che ha in mano, spese da farsi
// rimborsare, movimenti in attesa di verifica, bozze, le ultime spese con il loro stato e le cose da fare. Niente cifre di tutta
// l'associazione: le vedono responsabili e amministratori. Poche letture leggere: la pagina si apre in fretta anche con rete lenta.
type Mov = { id: string; ref: string | null; op_date: string; kind: string; description: string | null; amount: string; currency: string;
  amount_eur: string | null; sign: number; status: string; reimb_status: string | null };

export async function OperatorHome({ supabase, me, t, lang }: { supabase: SupabaseClient; me: Me; t: T; lang: Lang }) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const nb = lang === 'fr' ? ' ' : '';
  const now = orgNow();
  const td = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [{ data: bal }, { data: reqs }, { data: last }, { count: waiting }, { count: drafts }, { data: due }, { data: auts }, { data: fx }, { data: dls }, { data: notesRow }, { data: advAcc }, { data: noDoc }, { data: allAut }, { data: myReports }] = await Promise.all([
    supabase.rpc('account_balances'),
    supabase.from('advance_requests').select('account_id, report_by, status, authorized_amount, amount, currency, beneficiary_id').or(`beneficiary_id.eq.${me.id},requested_by.eq.${me.id}`).in('status', ['requested', 'authorized', 'delivered', 'reported']),
    supabase.from('movements').select('id, ref, op_date, kind, description, amount, currency, amount_eur, sign, status, reimb_status')
      .eq('created_by', me.id).order('created_at', { ascending: false }).limit(5).returns<Mov[]>(),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('created_by', me.id).eq('status', 'recorded'),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('created_by', me.id).eq('status', 'draft').is('reimb_status', null),
    supabase.from('movements').select('amount, currency, amount_eur').eq('created_by', me.id).eq('reimb_status', 'due'),
    supabase.from('self_certs').select('id, movement_id').is('signed_at', null).not('document_id', 'is', null).limit(20),
    // stesso tasso di Anticipi (quello del mese di oggi), così lo stesso importo vale gli stessi euro in tutte le pagine
    supabase.rpc('fx_rate_for', { p_date: td }).then((r) => ({ data: r.data != null ? { rate: r.data as number } : null })),
    supabase.from('deadlines').select('id, title, due_date, status').eq('status', 'open').is('movement_id', null).lte('due_date', `${now.getFullYear() + 1}-12-31`).order('due_date').limit(5),
    supabase.from('settings').select('value').eq('key', 'dashboard_notes').maybeSingle(),
    supabase.from('accounts').select('id, holder').eq('kind', 'advance'),
    // spese senza giustificativo: serve l'autocertificazione (anche prima che il PDF sia stato preparato)
    supabase.from('movements').select('id, ref').eq('created_by', me.id).not('no_doc_reason', 'is', null).or('status.neq.draft,reimb_status.eq.due').order('created_at', { ascending: false }).limit(20),
    supabase.from('self_certs').select('movement_id'),
    // errori segnalati dall'operatore e ancora aperti
    supabase.from('deadlines').select('id, movement_id, title, created_at').eq('status', 'open').eq('created_by', me.id).not('movement_id', 'is', null).limit(10),
  ]);
  const rate = Number(fx?.rate ?? 0);
  const eurOf = (v: number, cur: string) => (cur === 'EUR' ? v : rate ? v / rate : 0);
  type B = { account_id: string; name_it: string; name_fr: string | null; kind: string; currency: string; balance: string };
  type Rq = { account_id: string | null; report_by: string | null; status: string; authorized_amount: string | null; amount: string; currency: string; beneficiary_id: string };
  const allRq = (reqs ?? []) as Rq[];
  const rqs = allRq.filter((r) => r.beneficiary_id === me.id);   // contanti propri: solo dove sono io il beneficiario
  const toCollect = allRq.filter((r) => r.status === 'authorized');   // anche quelli chiesti per altre persone: li ritira chi li ha chiesti
  const waitReq = allRq.filter((r) => r.status === 'requested');   // revisione 20/11: le richieste in attesa si vedono anche qui
  const advIds = new Set([...rqs.filter((r) => (r.status === 'delivered' || r.status === 'reported') && r.account_id).map((r) => r.account_id!),
    ...((advAcc ?? []) as { id: string; holder: string | null }[]).filter((a) => (a.holder ?? '').toLowerCase() === me.full_name.toLowerCase()).map((a) => a.id)]);
  const myAdv = ((bal ?? []) as B[]).filter((b) => b.kind === 'advance' && advIds.has(b.account_id));
  const inHand = myAdv.reduce((s, b) => s + Number(b.balance), 0);
  const handCur = myAdv[0]?.currency ?? 'MGA';
  // O5 (giro 12): la data delle ricevute dalle stesse richieste consegnate che usa /anticipi (sui conti di anticipo che ho in mano)
  const myAdvIds = new Set(myAdv.map((b) => b.account_id));
  const reportBy = allRq.filter((r) => r.status === 'delivered' && r.account_id && myAdvIds.has(r.account_id)).map((r) => r.report_by).filter(Boolean).sort()[0] ?? null;
  const dueRows = (due ?? []) as { amount: string; currency: string; amount_eur: string | null }[];
  const dueEur = dueRows.reduce((s, r) => s + (r.currency === 'EUR' ? Number(r.amount) : Number(r.amount_eur ?? 0) || eurOf(Number(r.amount), r.currency)), 0);
  const autRows = (auts ?? []) as { id: string; movement_id: string }[];
  const notes = notesRow?.value as { text?: string; at?: string; by_name?: string } | null;
  const big = (eur: number, orig?: { v: number; cur: string }) => (
    <><div className="v num">{money(eur, 'EUR', lang)}</div>{orig && orig.cur !== 'EUR' && <div className="s num">{money(orig.v, orig.cur, lang)}</div>}</>);

  type Todo = { lvl: 'warn' | 'do' | 'ok'; ic: string; title: string; sub?: string; href: string; act?: string };
  const todo: Todo[] = [];
  const withAut = new Set(((allAut ?? []) as { movement_id: string }[]).map((r) => r.movement_id));
  const toPrepare = ((noDoc ?? []) as { id: string; ref: string | null }[]).filter((m) => !withAut.has(m.id));
  if (toPrepare.length) todo.push({ lvl: 'do', ic: 'receipt', title: L(`Autocertificazioni da preparare: ${toPrepare.length}`, `Attestations à préparer${nb}: ${toPrepare.length}`),
    sub: L('Spese senza giustificativo: apri la spesa e prepara il modulo', 'Dépenses sans justificatif : ouvrez la dépense et préparez le formulaire'), href: `/movimenti/${toPrepare[0]!.id}`, act: L('Apri', 'Ouvrir') });
  const reps = (myReports ?? []) as { id: string; movement_id: string }[];
  if (reps.length) todo.push({ lvl: 'do', ic: 'info', title: L(`Errori segnalati, in attesa del responsabile: ${reps.length}`, `Erreurs signalées, en attente du responsable${nb}: ${reps.length}`), href: `/movimenti/${reps[0]!.movement_id}` });
  if (autRows.length) todo.push({ lvl: 'do', ic: 'receipt', title: L(`Autocertificazioni da far firmare: ${autRows.length}`, `Attestations à faire signer${nb}: ${autRows.length}`),
    sub: L('Stampa il PDF, falla firmare e consegnala al responsabile', 'Imprimez le PDF, faites-la signer et remettez-la au responsable'), href: `/movimenti/${autRows[0]!.movement_id}`, act: L('Apri', 'Ouvrir') });
  if (waitReq.length) todo.push({ lvl: 'do', ic: 'wallet', title: waitReq.length === 1 ? L(`Richiesta di anticipo in attesa: ${money(Number(waitReq[0]!.amount), waitReq[0]!.currency, lang)}`, `Demande d’avance en attente : ${money(Number(waitReq[0]!.amount), waitReq[0]!.currency, lang)}`) : L(`Richieste di anticipo in attesa: ${waitReq.length}`, `Demandes d’avance en attente${nb}: ${waitReq.length}`),
    sub: L('La deve autorizzare un responsabile', 'Un responsable doit l’autoriser'), href: '/anticipi' });
  for (const r of toCollect) todo.push({ lvl: 'do', ic: 'wallet', title: L(`Anticipo autorizzato: ritira ${money(Number(r.authorized_amount ?? r.amount), r.currency, lang)}`, `Avance autorisée : retirez ${money(Number(r.authorized_amount ?? r.amount), r.currency, lang)}`),
    sub: L('I contanti te li consegna il responsabile della cassa', 'Le responsable de la caisse vous remet les espèces'), href: '/anticipi', act: L('Apri', 'Ouvrir') });
  if (myAdv.length && inHand > 0) todo.push({ lvl: reportBy && reportBy < td ? 'warn' : 'do', ic: 'wallet',
    title: L(`Hai in mano ${money(inHand, handCur, lang)}`, `Vous avez en main ${money(inHand, handCur, lang)}`),
    sub: reportBy ? L(`Porta le ricevute entro il ${date(reportBy)}`, `Apportez les reçus avant le ${date(reportBy)}`) : L('Registra ogni spesa con «Anticipo»', 'Enregistrez chaque dépense avec « Avance »'),
    href: '/nuovo', act: L('Registra', 'Saisir') });
  if (drafts) todo.push({ lvl: 'do', ic: 'pen', title: L(`Bozze da completare: ${drafts}`, `Brouillons à compléter${nb}: ${drafts}`), sub: L('Non contano finché non premi «Registra»', 'Ils ne comptent pas tant que vous n’appuyez pas sur « Comptabiliser »'), href: '/movimenti?stato=draft', act: L('Apri', 'Ouvrir') });
  for (const d of ((dls ?? []) as { id: string; title: string; due_date: string }[]).filter((x) => x.due_date <= `${td.slice(0, 8)}31`).slice(0, 3))
    todo.push({ lvl: d.due_date < td ? 'warn' : 'do', ic: 'cal', title: d.title, sub: date(d.due_date), href: '/scadenze' });
  if (!todo.length) todo.push({ lvl: 'ok', ic: 'check', title: L('Tutto in ordine', 'Tout est en ordre'), sub: L('Niente da completare, firmare o giustificare', 'Rien à compléter, signer ou justifier'), href: '/movimenti' });

  // H19 (giro 12): stesse pastiglie con icona di Movimenti
  const stLabel = (m: Mov) => m.reimb_status === 'due' ? <span className="chip ichip pend tiny"><Ico name="wallet" size={14} />{L('Da rimborsare', 'À rembourser')}</span>
    : <StatusChip s={m.status as 'draft'} label={t(`st_${m.status}` as 'st_draft')} />;
  const amt = (m: Mov) => { const s = m.kind === 'income' ? 1 : -1;
    return m.currency !== 'EUR' && m.amount_eur ? <span className="two"><b>{money(Number(m.amount_eur) * s * m.sign, 'EUR', lang)}</b><small>{money(Number(m.amount) * s * m.sign, m.currency, lang)}</small></span>
      : <span className="two"><b>{money(Number(m.amount) * s * m.sign, m.currency, lang)}</b></span>; };

  return (
    <div className="stack op-home">
      <div className="op-new"><Link className="btn primary" href="/nuovo"><CIcon name="plus" size={18} />{L('Registra una spesa', 'Saisir une dépense')}</Link></div>
      <div className="kpis dk">
        <Link className="kpi" href="/anticipi"><div className="l">{L('Contanti in mano', 'Espèces en main')}</div>
          {myAdv.length ? big(eurOf(inHand, handCur), { v: inHand, cur: handCur }) : <div className="v num">–</div>}
          <div className="s">{myAdv.length && inHand > 0 ? (reportBy ? L(`ricevute entro il ${date(reportBy)}`, `reçus avant le ${date(reportBy)}`) : L('contanti dell’anticipo', 'espèces de l’avance')) : toCollect.length ? L('anticipo autorizzato: da ritirare', 'avance autorisée : à retirer') : (myAdv.length ? L('nessun contante in mano', 'aucune espèce en main') : L('nessun anticipo aperto', 'aucune avance ouverte'))}</div></Link>
        <Link className="kpi" href="/rimborsi"><div className="l">{L('Da rimborsare a te', 'À vous rembourser')}</div>
          <div className="v num">{money(dueEur, 'EUR', lang)}</div>
          <div className="s">{dueRows.length === 1 ? L('1 spesa pagata di tasca tua', '1 dépense payée de votre poche') : L(`${dueRows.length} spese pagate di tasca tua`, `${dueRows.length} dépenses payées de votre poche`)}</div></Link>
        <Link className="kpi" href="/movimenti?stato=recorded"><div className="l">{L('Da verificare', 'À vérifier')}</div>
          <div className="v num">{waiting ?? 0}</div><div className="s">{L('le controlla un responsabile', 'un responsable les contrôle')}</div></Link>
        <Link className="kpi" href="/movimenti?stato=draft"><div className="l">{L('Bozze', 'Brouillons')}</div>
          <div className="v num">{drafts ?? 0}</div><div className="s">{L('da completare e registrare', 'à compléter et comptabiliser')}</div></Link>
      </div>
      <div className="home v2 yc">
        <div className="h-left">
          <section className="panel h-card op-last">
            <div className="panel-h"><H2 icon={null} text={L('Le mie ultime spese', 'Mes dernières dépenses')} /><div className="spacer" /><Link className="eyebrow" href="/movimenti">{L('Tutte', 'Toutes')} →</Link></div>
            {(last ?? []).length ? <ul className="op-list">{(last ?? []).map((m) => (
              <li key={m.id}><Link href={`/movimenti/${m.id}`}><span className="op-t"><b>{m.description || t(`k_${m.kind}` as 'k_expense')}</b>
                <small className="muted">{date(m.op_date)}{m.ref ? ` · ${m.ref}` : ''}</small></span>
                <span className="op-r num">{amt(m)}{stLabel(m)}</span></Link></li>))}</ul>
              : <div className="panel-b op-empty"><EmptyState title={L('Ancora nessuna spesa registrata da te', 'Aucune dépense saisie par vous pour l’instant')}
                text={L('Fotografa lo scontrino e registra la prima spesa: comparirà qui con il suo stato.', 'Photographiez le ticket et saisissez la première dépense : elle apparaîtra ici avec son état.')}
                action={<Link className="btn primary" href="/nuovo"><CIcon name="plus" size={16} />{L('Registra una spesa', 'Saisir une dépense')}</Link>} /></div>}
          </section>
        </div>
        <div className="h-side">
          <section className="panel h-todo">
            <div className="panel-h"><H2 icon={null} text={L('Da fare', 'À faire')} /><span className="eyebrow tday" style={{ marginLeft: 4 }}>{L('oggi', 'aujourd\'hui')} {date(td)}</span></div>
            <ul className="tlist">{todo.map((x, i) => (
              <li key={i} className={x.lvl}><span className={`dot ${x.lvl}`}><CIcon name={x.ic} size={13} /></span>
                <div className="tm"><div className="tt"><Link href={x.href}>{x.title}</Link></div>{x.sub && <div className="ts">{x.sub}</div>}</div>
                <div className="tr" /><div className="ta">{x.act && <Link className="btn small ghost" href={x.href}>{x.act}</Link>}</div></li>))}</ul>
          </section>
          <section className="panel h-note">
            <div className="panel-h"><H2 icon={null} text={L('Note', 'Notes')} /><div className="spacer" /><span className="eyebrow">{L('condivise', 'partagées')}</span></div>
            <div className="panel-b"><DashNotes text={notes?.text ?? ''} lang={lang} canWrite={true} meta={notes?.at ? `${notes.by_name ?? ''} · ${date(notes.at.slice(0, 10))}` : ''} /></div>
          </section>
        </div>
      </div>
    </div>
  );
}
