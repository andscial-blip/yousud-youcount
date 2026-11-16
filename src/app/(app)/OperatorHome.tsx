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
  const now = new Date();
  const td = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [{ data: bal }, { data: reqs }, { data: last }, { count: waiting }, { count: drafts }, { data: due }, { data: auts }, { data: fx }, { data: dls }, { data: notesRow }, { data: advAcc }] = await Promise.all([
    supabase.rpc('account_balances'),
    supabase.from('advance_requests').select('account_id, report_by, status, authorized_amount, amount, currency').eq('beneficiary_id', me.id).in('status', ['authorized', 'delivered', 'reported']),
    supabase.from('movements').select('id, ref, op_date, kind, description, amount, currency, amount_eur, sign, status, reimb_status')
      .eq('created_by', me.id).order('created_at', { ascending: false }).limit(5).returns<Mov[]>(),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('created_by', me.id).eq('status', 'recorded'),
    supabase.from('movements').select('id', { count: 'exact', head: true }).eq('created_by', me.id).eq('status', 'draft').is('reimb_status', null),
    supabase.from('movements').select('amount, currency, amount_eur').eq('created_by', me.id).eq('reimb_status', 'due'),
    supabase.from('self_certs').select('id, movement_id').is('signed_at', null).not('document_id', 'is', null).limit(20),
    // stesso tasso di Anticipi (quello del mese di oggi), così lo stesso importo vale gli stessi euro in tutte le pagine
    supabase.rpc('fx_rate_for', { p_date: td }).then((r) => ({ data: r.data != null ? { rate: r.data as number } : null })),
    supabase.from('deadlines').select('id, title, due_date, status').eq('status', 'open').lte('due_date', `${now.getFullYear() + 1}-12-31`).order('due_date').limit(5),
    supabase.from('settings').select('value').eq('key', 'dashboard_notes').maybeSingle(),
    supabase.from('accounts').select('id, holder').eq('kind', 'advance'),
  ]);
  const rate = Number(fx?.rate ?? 0);
  const eurOf = (v: number, cur: string) => (cur === 'EUR' ? v : rate ? v / rate : 0);
  type B = { account_id: string; name_it: string; name_fr: string | null; kind: string; currency: string; balance: string };
  type Rq = { account_id: string | null; report_by: string | null; status: string; authorized_amount: string | null; amount: string; currency: string };
  const rqs = (reqs ?? []) as Rq[];
  const toCollect = rqs.filter((r) => r.status === 'authorized');
  const advIds = new Set([...rqs.filter((r) => r.status !== 'authorized' && r.account_id).map((r) => r.account_id!),
    ...((advAcc ?? []) as { id: string; holder: string | null }[]).filter((a) => (a.holder ?? '').toLowerCase() === me.full_name.toLowerCase()).map((a) => a.id)]);
  const myAdv = ((bal ?? []) as B[]).filter((b) => b.kind === 'advance' && advIds.has(b.account_id));
  const inHand = myAdv.reduce((s, b) => s + Number(b.balance), 0);
  const handCur = myAdv[0]?.currency ?? 'MGA';
  const reportBy = rqs.filter((r) => r.status !== 'authorized').map((r) => r.report_by).filter(Boolean).sort()[0] ?? null;
  const dueRows = (due ?? []) as { amount: string; currency: string; amount_eur: string | null }[];
  const dueEur = dueRows.reduce((s, r) => s + (r.currency === 'EUR' ? Number(r.amount) : Number(r.amount_eur ?? 0) || eurOf(Number(r.amount), r.currency)), 0);
  const autRows = (auts ?? []) as { id: string; movement_id: string }[];
  const notes = notesRow?.value as { text?: string; at?: string; by_name?: string } | null;
  const big = (eur: number, orig?: { v: number; cur: string }) => (
    <><div className="v num">{money(eur, 'EUR', lang)}</div>{orig && orig.cur !== 'EUR' && <div className="s num">{money(orig.v, orig.cur, lang)}</div>}</>);

  type Todo = { lvl: 'warn' | 'do' | 'ok'; ic: string; title: string; sub?: string; href: string; act?: string };
  const todo: Todo[] = [];
  if (autRows.length) todo.push({ lvl: 'do', ic: 'receipt', title: L(`Autocertificazioni da far firmare: ${autRows.length}`, `Attestations à faire signer${nb}: ${autRows.length}`),
    sub: L('Stampa il PDF, falla firmare e consegnala al responsabile', 'Imprimez le PDF, faites-la signer et remettez-la au responsable'), href: `/movimenti/${autRows[0]!.movement_id}`, act: L('Apri', 'Ouvrir') });
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

  const stLabel = (m: Mov) => m.reimb_status === 'due' ? <span className="chip warn tiny">{L('In attesa di rimborso', 'En attente de remboursement')}</span>
    : <span className={`chip tiny ${m.status === 'verified' ? 'ok' : m.status === 'recorded' ? 'warn' : ''}`}>{t(`st_${m.status}` as 'st_draft')}</span>;
  const amt = (m: Mov) => { const s = m.kind === 'income' ? 1 : -1;
    return m.currency !== 'EUR' && m.amount_eur ? <span className="two"><b>{money(Number(m.amount_eur) * s * m.sign, 'EUR', lang)}</b><small>{money(Number(m.amount) * s * m.sign, m.currency, lang)}</small></span>
      : <span className="two"><b>{money(Number(m.amount) * s * m.sign, m.currency, lang)}</b></span>; };

  return (
    <div className="stack op-home">
      <div className="op-new"><Link className="btn primary" href="/nuovo"><CIcon name="plus" size={18} />{L('Registra una spesa', 'Saisir une dépense')}</Link></div>
      <div className="kpis dk">
        <Link className="kpi" href="/anticipi"><div className="l">{L('Contanti in mano', 'Espèces en main')}</div>
          {myAdv.length ? big(eurOf(inHand, handCur), { v: inHand, cur: handCur }) : <div className="v num">–</div>}
          <div className="s">{myAdv.length ? (reportBy ? L(`ricevute entro il ${date(reportBy)}`, `reçus avant le ${date(reportBy)}`) : L('anticipo ricevuto', 'avance reçue')) : toCollect.length ? L('anticipo autorizzato: da ritirare', 'avance autorisée : à retirer') : L('nessun anticipo aperto', 'aucune avance ouverte')}</div></Link>
        <Link className="kpi" href="/rimborsi"><div className="l">{L('Da rimborsare a te', 'À vous rembourser')}</div>
          <div className="v num">{money(dueEur, 'EUR', lang)}</div>
          <div className="s">{dueRows.length === 1 ? L('1 spesa pagata di tasca tua', '1 dépense payée de votre poche') : L(`${dueRows.length} spese pagate di tasca tua`, `${dueRows.length} dépenses payées de votre poche`)}</div></Link>
        <Link className="kpi" href="/movimenti?stato=recorded"><div className="l">{L('In attesa di verifica', 'En vérification')}</div>
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
              : <p className="panel-b muted" style={{ margin: 0 }}>{L('Ancora nessuna spesa registrata da te.', 'Aucune dépense saisie par vous pour l’instant.')}</p>}
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
