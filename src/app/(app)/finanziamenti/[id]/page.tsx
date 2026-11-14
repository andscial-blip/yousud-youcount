import Link from 'next/link';
import { notFound } from 'next/navigation';
import { can, requireMe, RESP, STAFF } from '@/lib/session';
import { date, money } from '@/lib/format';
import { Empty, H2, Panel } from '@/components/Page';
import { BudgetTable, type BudgetRow } from '@/components/Budget';
import { Legend, Lines, Viz } from '@/components/Charts';
import { DonorMark } from '@/components/DonorMark';
import { DonorLogoUpload } from '@/components/DonorLogoUpload';
import { setDonorLogo, setGrantStatus, updateGrant } from '../actions';
import { COUNTED, GrantFields, eurOf, missingDoc, timeOf, totals, type GrantRow, type Mv } from '../shared';

export const dynamic = 'force-dynamic';
const MESI_S = { it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'], fr: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'] } as const;
type Row = Mv & { id: string; description: string | null; amount: string; currency: string; category: { code: string } | null };

// Scheda del finanziamento nel disegno di Cairn (14/11, dopo il parere del gruppo di esperti): testata con logo o iniziali del
// finanziatore, quattro riquadri (concesso con il tempo trascorso, ricevuto, speso, disponibile in cassa), ricevuto e speso nel tempo,
// budget e speso per gruppo, qualità della rendicontazione, scadenze, rendiconto in Excel e movimenti. Contano i movimenti registrati o verificati.
export default async function GrantDetail({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string; modifica?: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const sp = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const today = new Date().toISOString().slice(0, 10);
  const { data: g } = await supabase.from('grants')
    .select('id, title, code, currency, amount, start_date, end_date, status, notes, donor:counterparties(id, name), project:projects(id, name)')
    .eq('id', id).maybeSingle<GrantRow>();
  if (!g) notFound();
  const staff = can(me, STAFF), resp = can(me, RESP);
  const [{ data: budget }, { data: ms }, { data: logo }, { data: dls }, { data: rate }, { data: donors }, { data: projects }] = await Promise.all([
    staff ? supabase.rpc('budget_vs_actual', { p_project: null, p_year: null, p_grant: id }) : Promise.resolve({ data: [] }),
    supabase.from('movements').select('id, grant_id, kind, description, amount, currency, amount_eur, sign, op_date, status, no_doc_reason, docs:movement_documents(count), category:categories(code)')
      .eq('grant_id', id).in('status', COUNTED).order('op_date', { ascending: false }).limit(5000).returns<Row[]>(),
    g.donor ? supabase.from('counterparty_logos').select('image').eq('counterparty_id', g.donor.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('deadlines').select('id, title, due_date').eq('grant_id', id).eq('status', 'open').order('due_date').limit(6),
    g.currency === 'MGA' ? supabase.rpc('fx_rate_for', { p_date: today }) : Promise.resolve({ data: null }),
    resp && sp.modifica === '1' ? supabase.from('counterparties').select('id, name').in('kind', ['donor', 'other']).order('name') : Promise.resolve({ data: [] }),
    resp && sp.modifica === '1' ? supabase.from('projects').select('id, name').order('name') : Promise.resolve({ data: [] }),
  ]);
  const moves = ms ?? [];
  const x = totals(moves);
  const fx = rate == null ? null : Number(rate);
  const granted = !g.amount ? 0 : g.currency === 'EUR' ? Number(g.amount) : fx ? Number(g.amount) / fx : 0;
  const e0 = (v: number) => money(Math.round(v), 'EUR', lang).replace(/,00(?=\s?€)/, '');
  const pc = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '–');
  const tm = timeOf(g, today);
  const net = x.rec - x.sp, over = granted > 0 && x.sp > granted + 0.005;
  // mesi dal primo all'ultimo tra periodo del finanziamento, movimenti e oggi (al massimo 36)
  const ym = (d: string) => d.slice(0, 7);
  const points = [g.start_date, g.end_date, ...moves.map((m) => m.op_date)].filter(Boolean).map((d) => ym(d!)).sort();
  const first = points[0] ?? ym(today), last = [points[points.length - 1] ?? ym(today)].sort().pop()!;
  const keys: string[] = [];
  for (let y = Number(first.slice(0, 4)), m = Number(first.slice(5)); keys.length < 36; m === 12 ? (y += 1, m = 1) : (m += 1)) {
    const k = `${y}-${String(m).padStart(2, '0')}`; keys.push(k); if (k >= last) break; }
  const mRec = keys.map(() => 0), mSp = keys.map(() => 0);
  for (const m of moves) { const k = keys.indexOf(ym(m.op_date)); if (k < 0) continue; if (m.kind === 'income') mRec[k] += eurOf(m); else if (m.kind === 'expense') mSp[k] += eurOf(m); }
  const cum = (vals: number[]) => { let s = 0; return vals.map((v, k) => (keys[k]! > ym(today) ? null : (s += v))); };
  const cats = keys.map((k) => `${MESI_S[lang][Number(k.slice(5)) - 1]} ${k.slice(2, 4)}`);
  // asse del grafico: al massimo una dozzina di etichette; riquadri: i 12 mesi fino a oggi (o fino all'ultimo mese del periodo)
  const step = Math.ceil(keys.length / 12), axis = cats.map((c, k) => (k % step === 0 ? c : ''));
  const endK = keys.indexOf(ym(today)) < 0 ? keys.length - 1 : keys.indexOf(ym(today)), w0 = Math.max(0, endK - 11);
  const win = (vals: number[]) => vals.slice(w0, endK + 1), winTip = (vals: number[]) => win(vals).map((v, n) => `${cats[w0 + n]}: ${e0(v)}`).join('\n');
  const tranches = moves.filter((m) => m.kind === 'income' && m.sign > 0).sort((a, b) => a.op_date.localeCompare(b.op_date));
  const bRows = ((budget ?? []) as BudgetRow[]).map((r) => ({ k: r.group_id, label: `${r.group_code} · ${lang === 'fr' && r.group_name_fr ? r.group_name_fr : r.group_name_it}`, b: Number(r.budget_eur ?? 0), s: Number(r.spent_eur ?? 0) })).filter((r) => r.b || r.s);
  const bMax = Math.max(1, ...bRows.flatMap((r) => [r.b, r.s]));
  const withDoc = x.nExp - x.miss - x.declared;
  const logoUrl = (logo as { image?: string } | null)?.image ?? null;
  const back = `/finanziamenti/${id}`;

  return (
    <div className="stack prj fin">
      {sp.ok && <div className="note ok" role="status">{sp.ok === 'budget' ? t('b_saved') : sp.ok === 'logo' ? L('Logo aggiornato.', 'Logo mis à jour.') : L('Salvato.', 'Enregistré.')}</div>}
      {sp.err && <div className="note err">{sp.err}</div>}
      <section className="panel g-head">
        <DonorMark name={g.donor?.name} logo={logoUrl} size={56} />
        <div className="g-ht">
          <h1>{g.title}</h1>
          <p>{[g.donor?.name ?? L('Finanziatore da indicare', 'Bailleur à préciser'), g.code].filter(Boolean).join(' · ')}
            {g.project && <> · <Link href={`/progetti/${g.project.id}`}>{g.project.name}</Link></>}</p>
        </div>
        <span className={`chip ${g.status === 'active' ? 'ok' : ''}`}>{g.status === 'active' ? L('in corso', 'en cours') : L('chiuso', 'clôturé')}</span>
        {resp && <div className="g-act">
          <Link className="btn" href={`${back}?modifica=1`} scroll={false}>{L('Modifica', 'Modifier')}</Link>
          <form action={setGrantStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={g.status === 'active' ? 'closed' : 'active'} />
            <button className="btn" type="submit">{g.status === 'active' ? L('Chiudi', 'Clôturer') : L('Riapri', 'Rouvrir')}</button></form>
        </div>}
      </section>

      <div className="kpis dk prk">
        <div className="kpi">
          <div className="l">{L('Concesso', 'Accordé')}</div>
          <div className={`v num${g.currency === 'MGA' ? ' long' : ''}`}>{g.amount ? money(Math.round(Number(g.amount)), g.currency, lang).replace(/,00(?=\s?€)/, '') : '–'}</div>
          {tm && <><Viz.Stack segs={[{ v: tm.p, c: 'var(--vz-plan)' }, { v: 1 - tm.p, c: 'var(--band)' }]} max={1} tip={`${date(g.start_date!)} – ${date(g.end_date!)}`} />
            <div className="vzl"><span>{L('tempo trascorso', 'temps écoulé')}</span><span>{Math.round(tm.p * 100)}{' '}%</span></div></>}
          <div className="s">{g.currency === 'MGA' && granted ? L(`circa ${e0(granted)} al tasso di oggi`, `environ ${e0(granted)} au taux du jour`)
            : !tm ? L('periodo da indicare', 'période à préciser') : tm.days < 0 ? L(`concluso da ${-tm.days} giorni`, `terminé depuis ${-tm.days} jours`) : tm.days === 0 ? L('termina oggi', 'se termine aujourd\'hui') : L(`${tm.days} giorni alla fine`, `${tm.days} jours avant la fin`)}</div>
        </div>
        <div className="kpi">
          <div className="l">{L('Ricevuto', 'Reçu')}</div>
          <div className="v num">{e0(x.rec)}</div>
          <Viz.Cols vals={win(mRec)} colors={win(mRec).map(() => 'var(--navy)')} tip={winTip(mRec)} />
          <div className="vzl"><span>{L('del concesso', 'de l\'accordé')}</span><span>{pc(x.rec, granted)}</span></div>
          <div className="s">{tranches.length === 1 ? L('1 incasso', '1 encaissement') : L(`${tranches.length} incassi`, `${tranches.length} encaissements`)}{granted - x.rec > 0.5 ? ` · ${L('da ricevere', 'à recevoir')} ${e0(granted - x.rec)}` : ''}</div>
        </div>
        <div className="kpi">
          <div className="l">{L('Speso', 'Dépensé')}</div>
          <div className={`v num ${over ? 'neg' : ''}`}>{e0(x.sp)}</div>
          <Viz.Cols vals={win(mSp)} colors={win(mSp).map(() => 'var(--vz-sp)')} tip={winTip(mSp)} />
          <div className="vzl"><span>{L('del concesso', 'de l\'accordé')}</span><span>{pc(x.sp, granted)}</span></div>
          <div className="s">{!granted ? L('importo concesso non indicato', 'montant accordé non indiqué') : over ? L(`oltre il concesso di ${e0(x.sp - granted)}`, `au-delà de l'accordé de ${e0(x.sp - granted)}`) : L(`da spendere ${e0(granted - x.sp)}`, `à dépenser ${e0(granted - x.sp)}`)}</div>
        </div>
        <div className="kpi">
          <div className="l">{L('Disponibile in cassa', 'Disponible en caisse')}</div>
          <div className={`v num ${net < -0.005 ? 'neg' : 'pos'}`}>{e0(net)}</div>
          {(x.rec > 0 || x.sp > 0) && <><Viz.Stack segs={net >= 0 ? [{ v: x.sp, c: 'var(--vz-sp)' }, { v: net, c: 'var(--green-soft)' }] : [{ v: x.rec, c: 'var(--navy)' }, { v: -net, c: 'var(--tax)' }]} max={Math.max(1, x.rec, x.sp)}
            tip={`${L('Ricevuto', 'Reçu')}: ${e0(x.rec)}\n${L('Speso', 'Dépensé')}: ${e0(x.sp)}`} />
            <div className="vzl"><span>{L('ricevuto meno speso', 'reçu moins dépensé')}</span><span>{net >= 0 ? pc(net, x.rec) : ''}</span></div></>}
          <div className="s">{net < -0.005 ? L('spese anticipate da YouSud', 'dépenses avancées par YouSud') : L('fondi ricevuti e non ancora spesi', 'fonds reçus et pas encore dépensés')}</div>
        </div>
      </div>

      <div className="prj-two">
        <section className="panel">
          <div className="panel-h"><H2 text={L('Ricevuto e speso nel tempo', 'Reçu et dépensé dans le temps')} icon={null} /></div>
          <div className="panel-b">{moves.length === 0 ? <p className="muted bq-none">{L('Nessun movimento collegato: il grafico compare con il primo incasso o la prima spesa.', 'Aucun mouvement lié : le graphique apparaît avec le premier encaissement ou la première dépense.')}</p> : (<>
            <Lines cats={axis} lang={lang} label={L('Ricevuto e speso cumulati', 'Reçu et dépensé cumulés')}
              series={[{ name: L('Ricevuto', 'Reçu'), vals: cum(mRec) as number[], color: 'var(--navy)', w: 2.4 }, { name: L('Speso', 'Dépensé'), vals: cum(mSp) as number[], color: 'var(--vz-sp)', w: 2.4 }]}
              refs={granted ? [{ v: granted, color: 'var(--vz-plan)', label: L('concesso', 'accordé') }] : undefined} />
            <Legend className="under" items={[{ label: L('Ricevuto', 'Reçu'), color: 'var(--navy)', value: e0(x.rec) }, { label: L('Speso', 'Dépensé'), color: 'var(--vz-sp)', value: e0(x.sp) },
              ...(granted ? [{ label: L('Concesso', 'Accordé'), color: 'var(--vz-plan)', value: e0(granted) }] : [])]} /></>)}</div>
        </section>
        <section className="panel">
          <div className="panel-h"><H2 text={L('Budget e speso per gruppo', 'Budget et dépensé par groupe')} icon={null} /><div className="spacer" />
            <Legend items={[{ label: 'Budget', color: 'var(--vz-plan)' }, { label: L('Speso', 'Dépensé'), color: 'var(--vz-sp)' }]} className="prj-leg" /></div>
          <div className="panel-b">{bRows.length === 0 ? <p className="muted bq-none">{staff ? L('Nessun budget e nessuna spesa: il budget per gruppo si imposta nella tabella qui sotto.', 'Aucun budget ni dépense : le budget par groupe se règle dans le tableau ci-dessous.') : L('Nessuna spesa collegata.', 'Aucune dépense liée.')}</p> : (
            <ul className="bq-pairs prj-pairs">{bRows.map((r) => (
              <li key={r.k}><span className="bq-pn">{r.label}</span>
                <span className="bq-pb"><i className={r.b > 0 ? '' : 'z'} style={{ width: `${((r.b / bMax) * 100).toFixed(1)}%`, background: 'var(--vz-plan)' }} />
                  <i className={r.s > 0 ? '' : 'z'} style={{ width: `${((r.s / bMax) * 100).toFixed(1)}%`, background: r.b > 0 && r.s > r.b ? 'var(--tax)' : 'var(--vz-sp)' }} /></span>
                <span className="bq-pv num"><b>{r.b ? e0(r.b) : '–'}</b><b>{e0(r.s)}</b></span></li>))}</ul>)}</div>
        </section>
      </div>

      <div className="prj-two">
        <section className="panel">
          <div className="panel-h"><H2 text={L('Qualità della rendicontazione', 'Qualité du rapport')} icon={null} /></div>
          <div className="panel-b">
            <dl className="g-q">
              <div><dt>{L('Spese con documento', 'Dépenses avec pièce')}</dt><dd className="num">{x.nExp ? `${withDoc} ${L('su', 'sur')} ${x.nExp}` : '–'}</dd>
                <span className="bqs-bar"><i style={{ width: `${x.nExp ? (withDoc / x.nExp) * 100 : 0}%`, background: 'var(--green-soft)' }} /></span></div>
              <div><dt>{L('Senza documento, motivo dichiarato', 'Sans pièce, motif déclaré')}</dt><dd className="num">{x.declared}</dd>
                <span className="bqs-bar"><i style={{ width: `${x.nExp ? (x.declared / x.nExp) * 100 : 0}%`, background: 'var(--vz-plan)' }} /></span></div>
              <div><dt>{L('Da documentare', 'À documenter')}</dt><dd className={`num ${x.miss ? 'neg' : ''}`}>{x.miss}</dd>
                <span className="bqs-bar"><i style={{ width: `${x.nExp ? (x.miss / x.nExp) * 100 : 0}%`, background: 'var(--tax)' }} /></span></div>
              <div><dt>{L('Spese ancora da verificare', 'Dépenses encore à vérifier')}</dt><dd className="num">{x.unver}</dd>
                <span className="bqs-bar"><i style={{ width: `${x.nExp ? (x.unver / x.nExp) * 100 : 0}%`, background: 'var(--vz-sp)' }} /></span></div>
            </dl>
            <p className="muted small fin-note">{L('Si contano le spese registrate o verificate. «Con documento»: almeno un file allegato. «Senza documento, motivo dichiarato»: nessun file, ma il motivo è scritto. «Da documentare»: né file né motivo.', 'On compte les dépenses enregistrées ou vérifiées. « Avec pièce » : au moins un fichier joint. « Sans pièce, motif déclaré » : aucun fichier, mais le motif est écrit. « À documenter » : ni fichier ni motif.')}</p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-h"><H2 text={L('Periodo e scadenze', 'Période et échéances')} icon={null} /><div className="spacer" /><Link className="eyebrow" href="/scadenze">{L('scadenziario', 'échéancier')} →</Link></div>
          <div className="panel-b">
            <dl className="kv g-kv">
              <dt>{L('Periodo', 'Période')}</dt><dd className="num">{g.start_date && g.end_date ? `${date(g.start_date)} – ${date(g.end_date)}` : '–'}</dd>
              <dt>{L('Progetto', 'Projet')}</dt><dd>{g.project ? <Link href={`/progetti/${g.project.id}`}>{g.project.name}</Link> : L('nessun progetto', 'aucun projet')}</dd>
              {g.notes && <><dt>{L('Note', 'Notes')}</dt><dd>{g.notes}</dd></>}
            </dl>
            {(dls ?? []).length === 0 ? <p className="muted small fin-note">{L('Nessuna scadenza aperta collegata a questo finanziamento.', 'Aucune échéance ouverte liée à ce financement.')}</p> : (
              <ul className="acclist g-dl">{dls!.map((d) => <li key={d.id}><span className={`cdp ${d.due_date < today ? 'late' : 'mid'}`}>{date(d.due_date)}</span><span className="an">{d.title}</span><span /></li>)}</ul>)}
          </div>
        </section>
      </div>

      {staff && (
        <Panel title={t('gr_title')} icon={null} pad>
          <form className="gr-form" method="get" action="/api/v1/export/finanziamento">
            <input type="hidden" name="id" value={g.id} />
            <label className="field"><span className="flabel">{t('gr_from')}</span><input className="input" type="date" name="dal" defaultValue={g.start_date ?? ''} /></label>
            <label className="field"><span className="flabel">{t('gr_to')}</span><input className="input" type="date" name="al" defaultValue={g.end_date ?? ''} /></label>
            <button className="btn primary" type="submit">{t('gr_download')}</button>
          </form>
        </Panel>
      )}
      {staff && (
        <Panel title={t('b_title')} icon={null} pad>
          <BudgetTable rows={(budget ?? []) as BudgetRow[]} t={t} lang={lang} edit={resp ? { scope: 'grant', id, back } : undefined} />
        </Panel>
      )}
      <Panel title={`${L('Movimenti collegati', 'Mouvements liés')} · ${moves.length}`} icon={null}>
        {moves.length === 0 ? <Empty text={L('Nessun movimento collegato. Il finanziamento si sceglie nel modulo del movimento.', 'Aucun mouvement lié. Le financement se choisit dans le formulaire du mouvement.')} /> : (
          <table className="t keep recent g-mv"><tbody>
            {moves.slice(0, 50).map((m) => {
              const sg = m.sign * (m.kind === 'income' ? 1 : -1), eur = m.currency !== 'EUR' && m.amount_eur ? Number(m.amount_eur) * sg : null;
              return (
                <tr key={m.id}>
                  <td><Link className="rowlink" href={`/movimenti/${m.id}`}>{m.description || t(`k_${m.kind as 'income'}`)}</Link>
                    <small className="muted rc-d"><span className="num">{date(m.op_date)}</span>{m.category?.code ? ` · ${m.category.code}` : ''}{missingDoc(m) ? ` · ${L('da documentare', 'à documenter')}` : !(m.docs?.[0]?.count) && m.no_doc_reason && m.kind === 'expense' ? ` · ${L('motivo dichiarato', 'motif déclaré')}` : ''}</small></td>
                  <td className="r num nw"><span className="two"><b>{eur != null ? money(eur, 'EUR', lang) : money(Number(m.amount) * sg, m.currency, lang)}</b>
                    {eur != null && <small>{money(Number(m.amount) * sg, m.currency, lang)}</small>}</span></td>
                </tr>);
            })}
          </tbody></table>
        )}
        {moves.length > 50 && <p className="panel-b muted small" style={{ margin: 0 }}>{L('Sono mostrati gli ultimi 50; il rendiconto in Excel li contiene tutti.', 'Les 50 derniers sont affichés ; le rapport Excel les contient tous.')}</p>}
      </Panel>

      {resp && sp.modifica === '1' && (
        <div className="sheet-bg dl-sheet-bg">
          <Link className="dl-sheet-x" href={back} scroll={false} aria-label={L('Chiudi', 'Fermer')} />
          <aside className="sheet sheet-help dl-sheet aw-sheet bq-sheet" role="dialog" aria-modal="true" aria-label={L('Modifica il finanziamento', 'Modifier le financement')}>
            <div className="sheet-h"><h2>{L('Modifica il finanziamento', 'Modifier le financement')}</h2><div className="spacer" />
              <Link className="btn ghost" href={back} scroll={false}>{L('Chiudi', 'Fermer')}</Link></div>
            <div className="sheet-b">
              <form action={updateGrant} className="fgrid bq-form">
                <input type="hidden" name="id" value={id} />
                <GrantFields L={L} g={g} donors={(donors ?? []) as { id: string; name: string }[]} projects={(projects ?? []) as { id: string; name: string }[]} />
                <div className="span2 bq-sub">
                  <button className="btn primary" type="submit">{L('Salva', 'Enregistrer')}</button>
                  <Link className="btn ghost" href={back} scroll={false}>{L('Annulla', 'Annuler')}</Link>
                </div>
              </form>
              <h3 className="g-lt">{L('Logo del finanziatore', 'Logo du bailleur')}</h3>
              {g.donor ? <DonorLogoUpload action={setDonorLogo} lang={lang} donorId={g.donor.id} ret={back} current={logoUrl} />
                : <p className="muted small" style={{ margin: 0 }}>{L('Indica prima il finanziatore e salva: poi qui si carica il suo logo.', 'Indiquez d\'abord le bailleur et enregistrez : son logo se charge ensuite ici.')}</p>}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
