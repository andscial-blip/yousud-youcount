import Link from 'next/link';
import { can, requireMe, RESP } from '@/lib/session';
import { date, money } from '@/lib/format';
import { Empty, ErrorNote, H2 } from '@/components/Page';
import { CIcon } from '@/components/CIcon';
import { Donut, Legend, PAL, Viz } from '@/components/Charts';
import { DonorMark } from '@/components/DonorMark';
import { createGrant } from './actions';
import { COUNTED, GrantFields, eurOf, timeOf, totals, type GrantRow, type Mv } from './shared';

export const dynamic = 'force-dynamic';
const MESI_S = { it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'], fr: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'] } as const;

// Finanziamenti nel disegno di Cairn (14/11, dopo il parere del gruppo di esperti): quattro riquadri (concesso, ricevuto, speso,
// disponibile in cassa), «Da chi arrivano i fondi» accanto a «Ricevuto e speso», poi una scheda per finanziamento con logo o
// iniziali del finanziatore, quota spesa, tempo trascorso e avvisi. Contano i movimenti registrati o verificati.
export default async function Grants({ searchParams }: { searchParams: Promise<{ err?: string; stato?: string; nuovo?: string }> }) {
  const sp = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const today = new Date().toISOString().slice(0, 10);
  const [{ data, error }, { data: donors }, { data: projects }, { data: moves }, { data: rate }] = await Promise.all([
    supabase.from('grants').select('id, title, code, currency, amount, start_date, end_date, status, donor:counterparties(id, name), project:projects(id, name)')
      .order('status').order('start_date', { ascending: false }).returns<GrantRow[]>(),
    supabase.from('counterparties').select('id, name').in('kind', ['donor', 'other']).eq('active', true).order('name'),
    supabase.from('projects').select('id, name').eq('active', true).order('name'),
    supabase.from('movements').select('grant_id, kind, amount_eur, sign, op_date, status, no_doc_reason, docs:movement_documents(count)')
      .not('grant_id', 'is', null).in('status', COUNTED).limit(50000).returns<Mv[]>(),
    supabase.rpc('fx_rate_for', { p_date: today }),
  ]);
  const all = data ?? [];
  const donorIds = [...new Set(all.map((g) => g.donor?.id).filter(Boolean))] as string[];
  const { data: logos } = donorIds.length ? await supabase.from('counterparty_logos').select('counterparty_id, image').in('counterparty_id', donorIds) : { data: [] };
  const logoOf = new Map((logos ?? []).map((l) => [l.counterparty_id as string, l.image as string]));
  const nActive = all.filter((g) => g.status === 'active').length;
  const stato = sp.stato === 'chiusi' || sp.stato === 'tutti' || sp.stato === 'attivi' ? sp.stato : nActive ? 'attivi' : 'tutti';
  const shown = all.filter((g) => stato === 'tutti' || (stato === 'attivi') === (g.status === 'active'));
  const ids = new Set(shown.map((g) => g.id));
  const byGrant = new Map<string, Mv[]>();
  for (const m of moves ?? []) { if (!m.grant_id) continue; const a = byGrant.get(m.grant_id) ?? []; a.push(m); byGrant.set(m.grant_id, a); }
  const fx = rate == null ? null : Number(rate);
  // concesso in euro: gli importi in ariary sono convertiti al tasso di oggi dell'app (valore indicativo)
  const granted = (g: GrantRow) => (!g.amount ? 0 : g.currency === 'EUR' ? Number(g.amount) : fx ? Number(g.amount) / fx : 0);
  const T = (g: GrantRow) => totals(byGrant.get(g.id) ?? []);
  const e0 = (v: number) => money(Math.round(v), 'EUR', lang).replace(/,00(?=\s?€)/, '');
  const pc = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '–');
  const sum = shown.reduce((s, g) => { const x = T(g); s.g += granted(g); s.rec += x.rec; s.sp += x.sp; s.miss += x.miss; if (x.sp > x.rec + 0.005) s.adv += 1; return s; }, { g: 0, rec: 0, sp: 0, miss: 0, adv: 0 });
  // ultimi 12 mesi, il corrente per ultimo
  const now = new Date(), keys = Array.from({ length: 12 }, (_, k) => { const d = new Date(now.getFullYear(), now.getMonth() - 11 + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const mRec = keys.map(() => 0), mSp = keys.map(() => 0);
  for (const m of moves ?? []) { if (!m.grant_id || !ids.has(m.grant_id)) continue; const k = keys.indexOf(m.op_date.slice(0, 7)); if (k < 0) continue;
    if (m.kind === 'income') mRec[k] += eurOf(m); else if (m.kind === 'expense') mSp[k] += eurOf(m); }
  const mTip = (title: string, vals: number[]) => `${title}\n${keys.map((k, n) => `${MESI_S[lang][Number(k.slice(5)) - 1]} ${k.slice(2, 4)}: ${e0(vals[n]!)}`).join('\n')}`;
  const byDonor = new Map<string, { label: string; v: number }>();
  for (const g of shown) { const k = g.donor?.id ?? ''; const x = byDonor.get(k) ?? { label: g.donor?.name ?? L('Finanziatore da indicare', 'Bailleur à préciser'), v: 0 }; x.v += granted(g); byDonor.set(k, x); }
  const dn = [...byDonor.entries()].map(([k, x]) => ({ k: k || 'none', ...x })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const dnTop = (dn.length > 6 ? [...dn.slice(0, 5), { k: 'rest', label: L(`Altri (${dn.length - 5})`, `Autres (${dn.length - 5})`), v: dn.slice(5).reduce((s, x) => s + x.v, 0) }] : dn).map((x, n) => ({ ...x, color: PAL[n % PAL.length] }));
  const maxPair = Math.max(1, ...shown.flatMap((g) => [granted(g), T(g).rec, T(g).sp]));
  const net = sum.rec - sum.sp;
  const tabs: [string, string, number][] = [['attivi', L('In corso', 'En cours'), nActive], ['chiusi', L('Chiusi', 'Clôturés'), all.length - nActive], ['tutti', L('Tutti', 'Tous'), all.length]];
  const resp = can(me, RESP);
  const nDon = new Set(shown.map((g) => g.donor?.id).filter(Boolean)).size;

  return (
    <div className="stack prj fin">
      {sp.err && <div className="note err">{sp.err}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />
      <div className="kpis dk prk">
        <div className="kpi">
          <div className="l">{L('Concesso', 'Accordé')}</div>
          <div className="v num">{e0(sum.g)}</div>
          {dnTop.length > 0 && <><Viz.Stack segs={dnTop.map((x) => ({ v: x.v, c: x.color }))} max={Math.max(1, sum.g)} tip={dn.map((x) => `${x.label}: ${e0(x.v)}`).join('\n')} />
            <div className="vzl"><span>{dnTop[0]!.label}</span><span>{pc(dnTop[0]!.v, sum.g)}</span></div></>}
          <div className="s">{shown.length === 1 ? L('1 finanziamento', '1 financement') : L(`${shown.length} finanziamenti`, `${shown.length} financements`)} · {nDon === 1 ? L('1 finanziatore', '1 bailleur') : L(`${nDon} finanziatori`, `${nDon} bailleurs`)}</div>
        </div>
        <div className="kpi">
          <div className="l">{L('Ricevuto', 'Reçu')}</div>
          <div className="v num">{e0(sum.rec)}</div>
          <Viz.Cols vals={mRec} colors={mRec.map(() => 'var(--navy)')} tip={mTip(L('Ricevuto, ultimi 12 mesi', 'Reçu, 12 derniers mois'), mRec)} />
          <div className="vzl"><span>{L('del concesso', 'de l\'accordé')}</span><span>{pc(sum.rec, sum.g)}</span></div>
          <div className="s">{sum.g - sum.rec > 0.5 ? L(`da ricevere ${e0(sum.g - sum.rec)}`, `à recevoir ${e0(sum.g - sum.rec)}`) : L('nulla da ricevere', 'rien à recevoir')}</div>
        </div>
        <div className="kpi">
          <div className="l">{L('Speso', 'Dépensé')}</div>
          <div className="v num">{e0(sum.sp)}</div>
          <Viz.Cols vals={mSp} colors={mSp.map(() => 'var(--vz-sp)')} tip={mTip(L('Speso, ultimi 12 mesi', 'Dépensé, 12 derniers mois'), mSp)} />
          <div className="vzl"><span>{L('del concesso', 'de l\'accordé')}</span><span>{pc(sum.sp, sum.g)}</span></div>
          <div className="s">{sum.miss ? (sum.miss === 1 ? L('1 spesa senza giustificativo', '1 dépense sans pièce') : L(`${sum.miss} spese senza giustificativo`, `${sum.miss} dépenses sans pièce`)) : L('tutte le spese con giustificativo', 'toutes les dépenses avec pièce')}</div>
        </div>
        <div className="kpi">
          <div className="l">{L('Disponibile in cassa', 'Disponible en caisse')}</div>
          <div className={`v num ${net < -0.005 ? 'neg' : 'pos'}`}>{e0(net)}</div>
          {(sum.rec > 0 || sum.sp > 0) && <><Viz.Stack segs={net >= 0 ? [{ v: sum.sp, c: 'var(--vz-sp)' }, { v: net, c: 'var(--green-soft)' }] : [{ v: sum.rec, c: 'var(--navy)' }, { v: -net, c: 'var(--tax)' }]} max={Math.max(1, sum.rec, sum.sp)}
            tip={`${L('Ricevuto', 'Reçu')}: ${e0(sum.rec)}\n${L('Speso', 'Dépensé')}: ${e0(sum.sp)}`} />
            <div className="vzl"><span>{L('ricevuto meno speso', 'reçu moins dépensé')}</span><span>{net >= 0 ? pc(net, sum.rec) : ''}</span></div></>}
          <div className="s">{sum.adv ? (sum.adv === 1 ? L('1 finanziamento anticipato da YouSud', '1 financement avancé par YouSud') : L(`${sum.adv} finanziamenti anticipati da YouSud`, `${sum.adv} financements avancés par YouSud`)) : L('nessuna spesa anticipata', 'aucune dépense avancée')}</div>
        </div>
      </div>

      <section className="panel fin-bar">
        <div className="segs" role="tablist" aria-label={L('Stato', 'État')}>
          {tabs.map(([k, l, n]) => <Link key={k} role="tab" aria-selected={stato === k} href={`/finanziamenti?stato=${k}`} scroll={false}>{l} · {n}</Link>)}
        </div>
        {resp && <Link className="btn primary" href={`/finanziamenti?stato=${stato}&nuovo=1`} scroll={false}><CIcon name="plus" size={16} />{L('Nuovo finanziamento', 'Nouveau financement')}</Link>}
      </section>

      {shown.length === 0 ? <section className="panel"><Empty text={all.length ? L('Nessun finanziamento in questo elenco.', 'Aucun financement dans cette liste.') : L('Nessun finanziamento: si aggiunge con «Nuovo finanziamento».', 'Aucun financement : il s\'ajoute avec « Nouveau financement ».')} /></section> : (<>
        <div className="prj-two">
          <section className="panel">
            <div className="panel-h"><H2 text={L('Da chi arrivano i fondi', 'D\'où viennent les fonds')} icon={null} /><div className="spacer" /><span className="eyebrow">{L('concesso', 'accordé')}</span></div>
            <div className="panel-b">{dnTop.length === 0 ? <p className="muted bq-none">{L('Nessun importo concesso indicato.', 'Aucun montant accordé indiqué.')}</p> : (
              <div className="bq-donut">
                <Donut items={dnTop.map((r) => ({ label: r.label, value: r.v, color: r.color, tip: `${r.label}: ${e0(r.v)} (${pc(r.v, sum.g)})` }))} center={{ label: L('Concesso', 'Accordé'), value: e0(sum.g) }} />
                <ul className="bq-dl">{dnTop.map((r) => <li key={r.k}><i style={{ background: r.color }} /><span>{r.label}</span><b className="num">{e0(r.v)}</b><small className="num">{pc(r.v, sum.g)}</small></li>)}</ul>
              </div>)}</div>
          </section>
          <section className="panel">
            <div className="panel-h"><H2 text={L('Ricevuto e speso', 'Reçu et dépensé')} icon={null} /><div className="spacer" />
              <Legend items={[{ label: L('Ricevuto', 'Reçu'), color: 'var(--navy)' }, { label: L('Speso', 'Dépensé'), color: 'var(--vz-sp)' }]} className="prj-leg" /></div>
            <div className="panel-b">
              <ul className="bq-pairs prj-pairs">{shown.map((g) => { const x = T(g), gr = granted(g); return (
                <li key={g.id}>
                  <Link className="bq-pn" href={`/finanziamenti/${g.id}`}>{g.title}</Link>
                  <span className="bq-pb fin-pb">{gr > 0 && <em style={{ left: `${((gr / maxPair) * 100).toFixed(1)}%` }} title={`${L('Concesso', 'Accordé')}: ${e0(gr)}`} />}
                    <i className={x.rec > 0 ? '' : 'z'} style={{ width: `${((x.rec / maxPair) * 100).toFixed(1)}%`, background: 'var(--navy)' }} />
                    <i className={x.sp > 0 ? '' : 'z'} style={{ width: `${((x.sp / maxPair) * 100).toFixed(1)}%`, background: gr > 0 && x.sp > gr ? 'var(--tax)' : 'var(--vz-sp)' }} /></span>
                  <span className="bq-pv num"><b>{e0(x.rec)}</b><b>{e0(x.sp)}</b></span>
                </li>); })}</ul>
              <p className="muted small fin-note">{L('La tacca indica l\'importo concesso.', 'Le repère indique le montant accordé.')}</p>
            </div>
          </section>
        </div>

        <div className="pring-grid">
          {shown.map((g) => {
            const x = T(g), gr = granted(g), used = gr ? x.sp / gr : 0, over = gr > 0 && x.sp > gr + 0.005, tm = timeOf(g, today);
            const R = 40, C = 2 * Math.PI * R, arc = Math.min(used, 1) * C;
            const note = over ? { c: 'late', t: L(`oltre di ${e0(x.sp - gr)}`, `dépassé de ${e0(x.sp - gr)}`) }
              : g.status !== 'active' ? { c: '', t: L('chiuso', 'clôturé') } : tm && tm.days < 0 ? { c: 'late', t: L('periodo concluso', 'période terminée') }
              : tm && tm.days <= 60 ? { c: 'mid', t: tm.days === 0 ? L('scade oggi', 'échoit aujourd\'hui') : L(`scade tra ${tm.days} giorni`, `échoit dans ${tm.days} jours`) } : null;
            return (
              <Link key={g.id} className="pring gcard" href={`/finanziamenti/${g.id}`}>
                <div className="pr-h"><DonorMark name={g.donor?.name} logo={g.donor ? logoOf.get(g.donor.id) : null} />
                  <div className="pr-n"><b>{g.title}</b><small>{[g.donor?.name ?? L('finanziatore da indicare', 'bailleur à préciser'), g.project?.name].filter(Boolean).join(' · ')}</small></div>
                  {note && <span className={`cdp ${note.c}`}>{note.t}</span>}</div>
                <div className="pr-mid">
                  <svg className="pr-ring" viewBox="0 0 100 100" role="img" aria-label={gr ? L(`Speso ${Math.round(used * 100)} % del concesso`, `Dépensé ${Math.round(used * 100)} % de l'accordé`) : L('importo concesso non indicato', 'montant accordé non indiqué')}>
                    <circle cx="50" cy="50" r={R} className="rg-t" />
                    {gr > 0 && x.sp > 0 && <circle cx="50" cy="50" r={R} className="rg-a" strokeDasharray={`${arc.toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 50 50)" style={over ? { stroke: 'var(--tax)' } : undefined} />}
                    <text x="50" y="55" textAnchor="middle" className="rg-v">{gr ? `${Math.round(used * 100)}%` : '–'}</text>
                  </svg>
                  <dl className="pr-nums">
                    <div><dt>{L('Concesso', 'Accordé')}</dt><dd className="num">{g.amount ? money(Math.round(Number(g.amount)), g.currency, lang).replace(/,00(?=\s?€)/, '') : '–'}</dd></div>
                    <div><dt>{L('Ricevuto', 'Reçu')}</dt><dd className="num">{e0(x.rec)}</dd></div>
                    <div><dt>{L('Speso', 'Dépensé')}</dt><dd className={`num ${over ? 'neg' : ''}`}>{e0(x.sp)}</dd></div>
                  </dl>
                </div>
                <div className="g-time">
                  <span className="g-tb"><i style={{ width: `${((tm?.p ?? 0) * 100).toFixed(1)}%` }} /></span>
                  <span className="g-tl"><span>{g.start_date && g.end_date ? `${date(g.start_date)} – ${date(g.end_date)}` : L('periodo da indicare', 'période à préciser')}</span>
                    <span>{tm ? L(`tempo ${Math.round(tm.p * 100)} %`, `temps ${Math.round(tm.p * 100)} %`) : ''}</span></span>
                </div>
                <div className="pr-f"><span>{!x.nExp ? L('nessuna spesa collegata', 'aucune dépense liée') : x.miss ? (x.miss === 1 ? L('1 giustificativo mancante', '1 pièce manquante') : L(`${x.miss} giustificativi mancanti`, `${x.miss} pièces manquantes`)) : L('giustificativi completi', 'pièces complètes')}</span>
                  <span>{g.code ?? ''}</span></div>
              </Link>
            );
          })}
        </div>
      </>)}

      {resp && sp.nuovo === '1' && (
        <div className="sheet-bg dl-sheet-bg">
          <Link className="dl-sheet-x" href={`/finanziamenti?stato=${stato}`} scroll={false} aria-label={L('Chiudi', 'Fermer')} />
          <aside className="sheet sheet-help dl-sheet aw-sheet bq-sheet" role="dialog" aria-modal="true" aria-label={L('Nuovo finanziamento', 'Nouveau financement')}>
            <div className="sheet-h"><h2>{L('Nuovo finanziamento', 'Nouveau financement')}</h2><div className="spacer" />
              <Link className="btn ghost" href={`/finanziamenti?stato=${stato}`} scroll={false}>{L('Chiudi', 'Fermer')}</Link></div>
            <div className="sheet-b">
              <form action={createGrant} className="fgrid bq-form">
                <GrantFields L={L} donors={(donors ?? []) as { id: string; name: string }[]} projects={(projects ?? []) as { id: string; name: string }[]} />
                <div className="span2 bq-sub">
                  <button className="btn primary" type="submit">{L('Salva', 'Enregistrer')}</button>
                  <Link className="btn ghost" href={`/finanziamenti?stato=${stato}`} scroll={false}>{L('Annulla', 'Annuler')}</Link>
                </div>
              </form>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
