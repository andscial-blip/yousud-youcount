import { Fragment } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FilterBar } from '@/components/FilterBar';
import { CIcon } from '@/components/CIcon';
import { Ico } from '@/components/Ui';
import { money, num } from '@/lib/format';
import { Denied, Empty, H2 } from '@/components/Page';
import { Donut, Legend, PAL } from '@/components/Charts';
import { BudgetRowForm } from '@/components/BudgetRowForm';
import { deleteItem, draftBudget, saveItem } from './actions';
import { BudgetNotes, BudgetTiles, C_EXP, C_INC, NoBudget, VersionBar, loadBudget, type Item } from './shared';

export const dynamic = 'force-dynamic';

const isId = (v?: string) => /^[0-9a-f-]{36}$/.test(v ?? '');
const UNITS = { it: ['mesi', 'giorni', 'ore', 'persone', 'pezzi', 'kit', 'viaggi', 'litri', 'kg', 'forfait'],
  fr: ['mois', 'jours', 'heures', 'personnes', 'pièces', 'kits', 'voyages', 'litres', 'kg', 'forfait'] };

// Preventivo analitico (richiesta del 12/11): in alto quattro riquadri, poi la composizione del preventivo in un grafico
// che si cambia con un selettore (per voce, la predefinita; per progetto; entrate e uscite; per controparte), poi la tabella di tutte le righe.
// Ogni riga ha numero, codice, descrizione, progetto, donatore o fornitore, quantità, unità, costo unitario e totale;
// si aggiunge, si modifica e si elimina da una scheda laterale dove tutto ciò che ha un elenco chiuso si sceglie da un menu.
// Il confronto con il consuntivo sta in Analisi › Preventivo. Il preventivo è solo annuale.
export default async function BudgetPage({ searchParams }: {
  searchParams: Promise<{ anno?: string; v?: string; vista?: string; grafico?: string; progetto?: string; tipo?: string; cp?: string; q?: string;
    nuova?: string; riga?: string; edit?: string; elimina?: string; schema?: string; ok?: string; err?: string; n?: string; lc?: string; lp?: string; apri?: string }>;
}) {
  const sp = await searchParams;
  // vecchi indirizzi: riepilogo e schema hanno la loro scheda, il confronto è in Analisi
  if (sp.vista === 'riepilogo' || sp.vista === 'riassunto' || sp.vista === 'schema') {
    redirect(`/preventivo/riepilogo?anno=${Number(sp.anno) || new Date().getFullYear()}${isId(sp.v) ? `&v=${sp.v}` : ''}${sp.vista !== 'riepilogo' || sp.schema === '1' ? '&schema=1' : ''}`);
  }
  if (sp.vista === 'confronto' || sp.vista === 'analisi') redirect(`/analisi?anno=${Number(sp.anno) || new Date().getFullYear()}&vista=budget`);
  const c = await loadBudget(sp);
  const { L, lang, year, shown, draft, its, catBy, prjBy, cpBy, CL, dirOf, eur, e0, m, totIn, totOut, editing, amending, needReason, resp } = c;
  if (!c.staff) return <Denied text={c.t('only_staff')} />;
  if (!shown) return <div className="stack bq"><BudgetNotes c={c} sp={sp} /><NoBudget c={c} /></div>;

  // ── filtri della tabella ──
  const prj = isId(sp.progetto) ? sp.progetto! : sp.progetto === 'gen' ? 'gen' : '';
  const tipo = sp.tipo === 'in' || sp.tipo === 'out' ? sp.tipo : '';
  const cp = isId(sp.cp) ? sp.cp! : '';
  const term = (sp.q ?? '').trim().slice(0, 80);
  const anyCp = its.some((i) => i.counterparty_id);
  // vista predefinita: «Per voce» (scelta di Andrea del 14/11)
  const graf = sp.grafico === 'progetti' || sp.grafico === 'flussi' || (sp.grafico === 'controparti' && anyCp) ? sp.grafico : 'voci';
  const filters = { progetto: prj, tipo, cp, q: term, grafico: graf === 'voci' ? '' : graf, apri: sp.apri ?? '' };
  const ret = Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const href = (q: Record<string, string | number | undefined | null> = {}, hash = '') => {
    const u = new URLSearchParams({ anno: String(year), v: shown.id });
    for (const [k, v] of Object.entries({ ...filters, ...q })) if (v !== undefined && v !== null && v !== '') u.set(k, String(v)); else u.delete(k);
    return `/preventivo?${u}${hash}`;
  };
  const norm = (x: string) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const prjName = (id: string | null) => (id ? prjBy.get(id) ?? '–' : L('Generale (struttura)', 'Général (structure)'));
  const text = (i: Item) => { const k = catBy.get(i.category_id);
    return norm([i.line_no, k?.code, k ? CL(k) : '', i.description, i.notes, prjName(i.project_id), i.counterparty_id ? cpBy.get(i.counterparty_id)?.name : '', i.unit].join(' ')); };
  const words = norm(term).split(/\s+/).filter(Boolean);
  const fil = its.filter((i) => (!prj || (prj === 'gen' ? i.project_id === null : i.project_id === prj)) && (!tipo || dirOf(i) === tipo)
    && (!cp || i.counterparty_id === cp) && (!words.length || words.every((w) => text(i).includes(w))));
  const nActive = (prj ? 1 : 0) + (tipo ? 1 : 0) + (cp ? 1 : 0);
  const rowsOf = (d: 'in' | 'out') => fil.filter((i) => dirOf(i) === d)
    .sort((a, b) => (catBy.get(a.category_id)?.code ?? '').localeCompare(catBy.get(b.category_id)?.code ?? '', 'it', { numeric: true }) || a.line_no - b.line_no);

  // ── gruppi richiudibili ──
  const openSet = new Set((sp.apri ?? '').split(',').filter(Boolean));
  const allOpen = openSet.has('tutti') || Boolean(term || prj || cp);
  const isOpen = (g: string) => allOpen || openSet.has(g) || (sp.riga ?? sp.elimina ?? '') !== '' && fil.some((i) => (i.id === sp.riga || i.id === sp.elimina) && (catBy.get(i.category_id)?.group_id ?? 'none') === g);
  const toggleOpen = (g: string) => { const n = new Set(openSet); n.delete('tutti'); if (n.has(g)) n.delete(g); else n.add(g); return [...n].join(',') || undefined; };
  const groupsOf = (d: 'in' | 'out') => { const mp = new Map<string, Item[]>();
    for (const i of rowsOf(d)) { const g = catBy.get(i.category_id)?.group_id ?? 'none'; mp.set(g, [...(mp.get(g) ?? []), i]); }
    return [...mp.entries()].map(([id, rows]) => ({ id, rows, label: id === 'none' ? L('Senza gruppo', 'Sans groupe') : grpLabel(id), tot: eur(rows) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'it', { numeric: true })); };

  // ── chi può fare cosa ──
  const rowActions = Boolean(editing || amending);
  const edit = rowActions ? its.find((i) => i.id === (sp.riga ?? sp.edit)) : undefined;
  const isNew = rowActions && sp.nuova === '1' && !edit;
  const delRow = rowActions ? its.find((i) => i.id === sp.elimina) : undefined;
  const reason = Boolean(amending && needReason);
  const lastCat = isId(sp.lc) ? sp.lc! : '';
  const lastPrj = isId(sp.lp) ? sp.lp! : prj && prj !== 'gen' ? prj : '';

  // ── composizione del preventivo (tutta la versione mostrata) ──
  const pc = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '');
  const sumBy = <K extends string>(xs: Item[], key: (i: Item) => K) => { const mp = new Map<K, number>();
    for (const i of xs) mp.set(key(i), (mp.get(key(i)) ?? 0) + Number(i.amount_eur)); return mp; };
  const outs = its.filter((i) => dirOf(i) === 'out'), ins = its.filter((i) => dirOf(i) === 'in');
  const byPrj = [...new Set(its.map((i) => i.project_id ?? ''))].map((p) => ({ id: p, label: prjName(p || null),
    inc: eur(ins.filter((i) => (i.project_id ?? '') === p)), out: eur(outs.filter((i) => (i.project_id ?? '') === p)) }))
    .sort((a, b) => b.out - a.out || b.inc - a.inc);
  const maxPrj = Math.max(1, ...byPrj.flatMap((p) => [p.inc, p.out]));
  const top = (mp: Map<string, number>, label: (k: string) => string, n: number) => {
    const all = [...mp.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, label: label(k), v }));
    const rest = all.slice(n).reduce((s, x) => s + x.v, 0);
    return rest > 0 ? [...all.slice(0, n), { k: 'rest', label: L(`Altre voci (${all.length - n})`, `Autres postes (${all.length - n})`), v: rest }] : all;
  };
  const grpLabel = (k: string) => { const g = c.grpBy.get(k); return g ? `${g.code} · ${CL(g)}` : L('Senza gruppo', 'Sans groupe'); };
  const catLabel = (k: string) => { const x = catBy.get(k); return x ? `${x.code} · ${CL(x)}` : '–'; };
  const cpLabel = (k: string) => (k ? cpBy.get(k)?.name ?? '–' : L('Non indicato', 'Non indiqué'));
  const BarList = ({ rows, color, tot }: { rows: { k: string; label: string; v: number }[]; color: string; tot: number }) => {
    // scala sulla voce più grande; «Altre voci» è una somma: barra grigia, al massimo piena
    const max = Math.max(1, ...rows.filter((r) => r.k !== 'rest').map((r) => r.v));
    return rows.length === 0 ? <p className="muted bq-none">{L('Nessuna riga.', 'Aucune ligne.')}</p> : (
      <ul className="bq-bars">{rows.map((r) => (
        <li key={r.k}><span className="bq-bn">{r.label}</span><b className="num">{e0(r.v)}<small>{pc(r.v, tot)}</small></b>
          <span className="bq-bb"><i style={{ width: `${(Math.min(r.v / max, 1) * 100).toFixed(1)}%`, background: r.k === 'rest' ? 'var(--line)' : color }} /></span></li>))}</ul>);
  };
  const DonutBlock = ({ title, xs, tot }: { title: string; xs: Item[]; tot: number }) => {
    const rows = top(sumBy(xs, (i) => catBy.get(i.category_id)?.group_id ?? ''), grpLabel, 5).map((r, n) => ({ ...r, color: PAL[n % PAL.length] }));
    return (
      <div className="bq-half">
        <h3>{title}</h3>
        {rows.length === 0 ? <p className="muted bq-none">{L('Nessuna riga.', 'Aucune ligne.')}</p> : (
          <div className="bq-donut">
            <Donut items={rows.map((r) => ({ label: r.label, value: r.v, color: r.color, tip: `${r.label}: ${e0(r.v)} (${pc(r.v, tot)})` }))} center={{ label: title, value: e0(tot) }} />
            <ul className="bq-dl">{rows.map((r) => (
              <li key={r.k}><i style={{ background: r.color }} /><span>{r.label}</span><b className="num">{e0(r.v)}</b><small className="num">{pc(r.v, tot)}</small></li>))}</ul>
          </div>)}
      </div>);
  };
  const tabs: [string, string][] = [['voci', L('Per voce', 'Par poste')], ['progetti', L('Per progetto', 'Par projet')], ['flussi', L('Entrate e uscite', 'Recettes et dépenses')],
    ...(anyCp ? [['controparti', L('Per controparte', 'Par contrepartie')] as [string, string]] : [])];
  const maxFlow = Math.max(1, totIn, totOut);

  // ── elenchi chiusi per la scheda della riga ──
  const formProps = (isNew || edit) ? {
    cats: { out: c.cats.filter((k) => k.direction === 'out' && (k.active || k.id === edit?.category_id)).map((k) => ({ id: k.id, label: `${k.code} · ${CL(k)}` })),
      in: c.cats.filter((k) => k.direction === 'in' && (k.active || k.id === edit?.category_id)).map((k) => ({ id: k.id, label: `${k.code} · ${CL(k)}` })) },
    projects: c.projects.filter((p) => p.active || p.id === edit?.project_id)
      .sort((a, b) => (a.kind === 'structure' ? -1 : 0) - (b.kind === 'structure' ? -1 : 0) || a.name.localeCompare(b.name)).map((p) => ({ id: p.id, label: p.name })),
    parties: (() => { const ok = c.cps.filter((k) => k.active || k.id === edit?.counterparty_id); const o = (xs: typeof ok) => xs.map((k) => ({ id: k.id, label: k.name }));
      return { donor: o(ok.filter((k) => k.kind === 'donor')), supplier: o(ok.filter((k) => k.kind === 'supplier')), other: o(ok.filter((k) => k.kind !== 'donor' && k.kind !== 'supplier')) }; })(),
    units: [...new Set([...its.map((i) => i.unit ?? '').filter(Boolean), ...UNITS[lang]])],
  } : null;
  const close = href();

  const Row = ({ i }: { i: Item }) => {
    const k = catBy.get(i.category_id); const party = i.counterparty_id ? cpBy.get(i.counterparty_id)?.name : null;
    const q = `${num(Number(i.qty), lang)}${i.unit ? ` ${i.unit}` : ''}`;
    return (
      <tr id={`r-${i.id}`} className={`bq-r${edit?.id === i.id || delRow?.id === i.id ? ' sel' : ''}`}>
        <td className="bq-n num">{i.line_no}</td>
        <td className="bq-c"><b>{k?.code}</b><span>{k ? CL(k) : ''}</span></td>
        <td className="bq-d">{i.description || <span className="muted">–</span>}{i.notes && <small>{i.notes}</small>}</td>
        <td className="bq-p">{i.project_id ? prjBy.get(i.project_id) : <span className="muted">{L('Generale', 'Général')}</span>}{party && <small className="bq-pk">{party}</small>}</td>
        <td className="bq-k">{party ?? <span className="muted">–</span>}</td>
        <td className="bq-q r num">{num(Number(i.qty), lang)}{i.unit && <span className="bq-qu"> {i.unit}</span>}</td>
        <td className="bq-u">{i.unit || <span className="muted">–</span>}</td>
        <td className="bq-uc r num">{money(i.unit_cost, i.currency, lang)}{i.currency === 'MGA' && i.fx_rate ? <small>{L('tasso', 'taux')} {num(Number(i.fx_rate), lang)}</small> : null}</td>
        <td className="bq-tt r num"><b>{m(i.amount_eur)}</b>{i.currency !== 'EUR' && <small>{money(i.amount, i.currency, lang)}</small>}</td>
        <td className="bq-m">{[i.project_id ? prjBy.get(i.project_id) : L('Generale', 'Général'), party, `${q} × ${money(i.unit_cost, i.currency, lang)}`].filter(Boolean).join(' · ')}</td>
        {rowActions && <td className="bq-a">
          <Link className="btn small" href={href({ riga: i.id })} scroll={false} aria-label={L(`Modifica la riga ${i.line_no}`, `Modifier la ligne ${i.line_no}`)} title={L('Modifica', 'Modifier')}><CIcon name="pen" size={15} /><span>{L('Modifica', 'Modifier')}</span></Link>
          <Link className="btn small bq-del" href={href({ elimina: i.id })} scroll={false} aria-label={L(`Elimina la riga ${i.line_no}`, `Supprimer la ligne ${i.line_no}`)} title={L('Elimina', 'Supprimer')}><CIcon name="trash" size={15} /><span>{L('Elimina', 'Supprimer')}</span></Link></td>}
      </tr>);
  };
  // celle vuote delle righe di sezione e del saldo: una per colonna, così restano allineate anche quando due colonne si nascondono
  const gap = <><td className="bq-p" /><td className="bq-k" /><td className="bq-q" /><td className="bq-u" /><td className="bq-uc" /></>;
  const fIn = eur(rowsOf('in')), fOut = eur(rowsOf('out'));

  return (
    <div className="stack bq">
      <BudgetNotes c={c} sp={sp} />
      <BudgetTiles c={c} />
      <VersionBar c={c} base="/preventivo" />

      <section className="panel bq-comp">
        <div className="panel-h"><H2 text={L('Composizione del preventivo', 'Composition du budget')} icon="chart" /><div className="spacer" />
          <div className="segs" role="tablist" aria-label={L('Grafico', 'Graphique')}>
            {tabs.map(([k, l]) => <Link key={k} role="tab" aria-selected={graf === k} href={href({ grafico: k === 'voci' ? '' : k })} scroll={false}>{l}</Link>)}
          </div></div>
        <div className="panel-b">
          {its.length === 0 ? <Empty text={L('Il preventivo è vuoto: aggiungi la prima riga qui sotto.', 'Le budget est vide : ajoutez la première ligne ci-dessous.')} />
          : graf === 'progetti' ? (<>
            <Legend items={[{ label: L('Entrate', 'Recettes'), color: C_INC }, { label: L('Uscite', 'Dépenses'), color: C_EXP }]} className="bq-leg" />
            <ul className="bq-pairs">{byPrj.map((p) => (
              <li key={p.id || 'gen'}>
                <Link className="bq-pn" href={href({ progetto: p.id || 'gen' }, '#righe')} title={L('Mostra le righe di questo progetto', 'Afficher les lignes de ce projet')}>{p.label}</Link>
                <span className="bq-pb"><i className={p.inc > 0 ? '' : 'z'} style={{ width: `${((p.inc / maxPrj) * 100).toFixed(1)}%`, background: C_INC }} /><i className={p.out > 0 ? '' : 'z'} style={{ width: `${((p.out / maxPrj) * 100).toFixed(1)}%`, background: C_EXP }} /></span>
                <span className="bq-pv num"><b>{e0(p.inc)}</b><b>{e0(p.out)}</b></span>
              </li>))}</ul>
          </>) : graf === 'voci' ? (
            <div className="bq-two">
              <DonutBlock title={L('Uscite', 'Dépenses')} xs={outs} tot={totOut} />
              <DonutBlock title={L('Entrate', 'Recettes')} xs={ins} tot={totIn} />
            </div>
          ) : graf === 'flussi' ? (<>
            <ul className="bq-flow">
              <li><span>{L('Entrate', 'Recettes')}</span><span className="bq-bb"><i style={{ width: `${((totIn / maxFlow) * 100).toFixed(1)}%`, background: C_INC }} /></span><b className="num">{e0(totIn)}</b></li>
              <li><span>{L('Uscite', 'Dépenses')}</span><span className="bq-bb"><i style={{ width: `${((totOut / maxFlow) * 100).toFixed(1)}%`, background: C_EXP }} /></span><b className="num">{e0(totOut)}</b></li>
              <li className="bq-net"><span>{L('Saldo previsto', 'Solde prévu')}</span><span /><b className={`num ${totIn - totOut < -0.005 ? 'neg' : 'pos'}`}>{e0(totIn - totOut)}</b></li>
            </ul>
            <div className="bq-two">
              <div className="bq-half"><h3>{L('Entrate principali', 'Principales recettes')}</h3><BarList rows={top(sumBy(ins, (i) => i.category_id), catLabel, 6)} color={C_INC} tot={totIn} /></div>
              <div className="bq-half"><h3>{L('Uscite principali', 'Principales dépenses')}</h3><BarList rows={top(sumBy(outs, (i) => i.category_id), catLabel, 6)} color={C_EXP} tot={totOut} /></div>
            </div>
          </>) : (
            <div className="bq-two">
              <div className="bq-half"><h3>{L('Entrate per donatore', 'Recettes par donateur')}</h3><BarList rows={top(sumBy(ins, (i) => i.counterparty_id ?? ''), cpLabel, 6)} color={C_INC} tot={totIn} /></div>
              <div className="bq-half"><h3>{L('Uscite per fornitore', 'Dépenses par fournisseur')}</h3><BarList rows={top(sumBy(outs, (i) => i.counterparty_id ?? ''), cpLabel, 6)} color={C_EXP} tot={totOut} /></div>
            </div>
          )}
        </div>
      </section>

      <section className="panel rb-panel bq-rows" id="righe">
        <div className="panel-h"><H2 text={`${L('Righe del preventivo', 'Lignes du budget')} · ${fil.length === its.length ? its.length : `${fil.length} ${L('di', 'sur')} ${its.length}`}`} icon="list" /><div className="spacer" />
          {rowActions ? <Link className="btn primary" href={href({ nuova: 1 })} scroll={false}><CIcon name="plus" size={16} />{L('Aggiungi riga', 'Ajouter une ligne')}</Link>
            : resp && shown.status === 'approved' ? (draft
              ? <Link className="btn primary" href={`/preventivo?anno=${year}&v=${draft.id}&nuova=1`}><CIcon name="plus" size={16} />{L('Aggiungi riga nella bozza', 'Ajouter au brouillon')}</Link>
              : <form action={draftBudget}><input type="hidden" name="year" value={year} /><input type="hidden" name="add" value="1" />
                <button className="btn primary" type="submit"><CIcon name="plus" size={16} />{L('Aggiungi riga (apre una revisione)', 'Ajouter (ouvre une révision)')}</button></form>) : null}
        </div>
        <FilterBar action="/preventivo" lang={lang} hidden={{ anno: String(year), v: shown.id, grafico: filters.grafico }} className="bq-fbar"
          search={{ value: term, placeholder: L('Cerca per numero, codice, descrizione…', 'Chercher par numéro, code, description…') }}
          active={nActive} reset={term || nActive ? href({ progetto: '', tipo: '', cp: '', q: '' }, '#righe') : null}
          result={L(`Mostra ${fil.length} righe`, `Afficher ${fil.length} lignes`)}
          after={<a className="btn fb-exp" href={`/api/v1/export/budget?anno=${year}&v=${shown.id}`} aria-label={c.t('exp_xlsx')}><Ico name="download" /><span>{c.t('exp_xlsx')}</span></a>}>
          <label className="field"><span className="flabel">{L('Tipo', 'Type')}</span>
            <select className="input" name="tipo" defaultValue={tipo}><option value="">{L('Entrate e uscite', 'Recettes et dépenses')}</option>
              <option value="out">{L('Solo uscite', 'Dépenses seulement')}</option><option value="in">{L('Solo entrate', 'Recettes seulement')}</option></select></label>
          <label className="field"><span className="flabel">{L('Progetto', 'Projet')}</span>
            <select className="input" name="progetto" defaultValue={prj}><option value="">{L('Tutti i progetti', 'Tous les projets')}</option>
              <option value="gen">{L('Generale (struttura)', 'Général (structure)')}</option>
              {c.projects.filter((p) => its.some((i) => i.project_id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          {anyCp && <label className="field"><span className="flabel">{L('Donatore o fornitore', 'Donateur ou fournisseur')}</span>
            <select className="input" name="cp" defaultValue={cp}><option value="">{L('Tutti', 'Tous')}</option>
              {c.cps.filter((k) => its.some((i) => i.counterparty_id === k.id)).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></label>}
        </FilterBar>
        <p className="bq-hint">{editing ? L('Bozza: le righe si aggiungono, si modificano e si eliminano liberamente. Diventa il preventivo in vigore con l\'approvazione.', 'Brouillon : les lignes s\'ajoutent, se modifient et se suppriment librement. Il devient le budget en vigueur à l\'approbation.')
          : amending ? (shown.demo ? L('Versione DEMO in vigore: righe modificabili senza indicare il motivo.', 'Version DEMO en vigueur : lignes modifiables sans indiquer le motif.')
            : L('Versione approvata: ogni aggiunta, modifica o eliminazione chiede il motivo e resta nello storico.', 'Version approuvée : chaque ajout, modification ou suppression demande le motif et reste dans l\'historique.'))
          : shown.status === 'draft' ? L('Bozza in preparazione: la modificano gli amministratori e i responsabili.', 'Brouillon en préparation : il est modifié par les administrateurs et les responsables.')
          : shown.status === 'superseded' ? L('Versione superata: si consulta, non si modifica.', 'Version remplacée : consultable, non modifiable.')
          : L('Versione approvata: la modifica un amministratore; un responsabile prepara una revisione.', 'Version approuvée : un administrateur la modifie ; un responsable prépare une révision.')}</p>
        {its.length === 0 ? <Empty text={L('Nessuna riga: il preventivo si costruisce con «Aggiungi riga».', 'Aucune ligne : le budget se construit avec « Ajouter une ligne ».')} />
        : fil.length === 0 ? <p className="panel-b muted" style={{ margin: 0 }}>{L('Nessuna riga corrisponde ai filtri.', 'Aucune ligne ne correspond aux filtres.')}</p> : (
          <div className="tscroll">
            {!(term || prj || cp) && <p className="bq-openall"><Link className="btn small" href={href({ apri: openSet.has('tutti') ? undefined : 'tutti' })} scroll={false}>{openSet.has('tutti') ? L('Chiudi tutti i gruppi', 'Fermer tous les groupes') : L('Apri tutti i gruppi', 'Ouvrir tous les groupes')}</Link>
              <span className="muted small">{L('Tocca un gruppo per vedere le sue righe.', 'Touchez un groupe pour voir ses lignes.')}</span></p>}
            <table className="t keep bq-tab">
              <thead><tr>
                <th className="bq-n">{L('N.', 'N°')}</th><th className="bq-c">{L('Codice', 'Code')}</th><th className="bq-d">{L('Descrizione', 'Description')}</th><th className="bq-p">{L('Progetto', 'Projet')}</th>
                <th className="bq-k">{L('Donatore / Fornitore', 'Donateur / Fournisseur')}</th><th className="bq-q r">{L('Quantità', 'Quantité')}</th><th className="bq-u">{L('Unità', 'Unité')}</th>
                <th className="bq-uc r">{L('Costo unitario', 'Coût unitaire')}</th><th className="bq-tt r">{L('Totale', 'Total')}</th>{rowActions && <th className="bq-a"><span className="sr-only">{L('Azioni', 'Actions')}</span></th>}
              </tr></thead>
              {(['out', 'in'] as const).filter((d) => rowsOf(d).length > 0).map((d) => (
                <tbody key={d}>
                  <tr className="bq-sec"><th colSpan={3} scope="rowgroup">{d === 'out' ? L('Uscite', 'Dépenses') : L('Entrate', 'Recettes')} · {rowsOf(d).length}</th>{gap}
                    <td className="bq-tt r num"><b>{m(d === 'out' ? fOut : fIn)}</b></td>{rowActions && <td className="bq-a" />}</tr>
                  {/* righe raccolte per gruppo di voci, con subtotale: chiuse all'apertura (344 righe erano 61.000 px su telefono);
                      ricerca e filtri aprono i gruppi che contengono risultati */}
                  {groupsOf(d).map((g) => (<Fragment key={g.id}>
                    <tr className={`bq-grp${isOpen(g.id) ? ' open' : ''}`}><th colSpan={3} scope="rowgroup">
                      <Link href={href({ apri: toggleOpen(g.id) }, `#g-${g.id}`)} scroll={false} id={`g-${g.id}`} aria-expanded={isOpen(g.id)}>
                        <span className="bq-car" aria-hidden="true">{isOpen(g.id) ? '▾' : '▸'}</span>{g.label}<small>{g.rows.length} {g.rows.length === 1 ? L('riga', 'ligne') : L('righe', 'lignes')}</small></Link></th>{gap}
                      <td className="bq-tt r num">{m(g.tot)}</td>{rowActions && <td className="bq-a" />}</tr>
                    {isOpen(g.id) && g.rows.map((i) => <Row key={i.id} i={i} />)}
                  </Fragment>))}
                </tbody>
              ))}
              {!tipo && <tfoot><tr className="bq-tot"><th colSpan={3}>{L('Saldo previsto (entrate − uscite)', 'Solde prévu (recettes − dépenses)')}</th>{gap}
                <td className={`bq-tt r num ${fIn - fOut < -0.005 ? 'neg' : ''}`}><b>{m(fIn - fOut)}</b></td>{rowActions && <td className="bq-a" />}</tr></tfoot>}
            </table>
          </div>
        )}
      </section>

      {(isNew || edit) && formProps && (
        <div className="sheet-bg dl-sheet-bg">
          <Link className="dl-sheet-x" href={close} scroll={false} aria-label={L('Chiudi', 'Fermer')} />
          <aside className="sheet sheet-help dl-sheet aw-sheet bq-sheet" role="dialog" aria-modal="true" aria-label={edit ? L(`Riga n. ${edit.line_no}`, `Ligne n° ${edit.line_no}`) : L('Nuova riga', 'Nouvelle ligne')}>
            <div className="sheet-h"><h2>{edit ? L(`Riga n. ${edit.line_no}`, `Ligne n° ${edit.line_no}`) : L('Nuova riga del preventivo', 'Nouvelle ligne du budget')}</h2><div className="spacer" />
              <Link className="btn ghost" href={close} scroll={false}>{L('Chiudi', 'Fermer')}</Link></div>
            <div className="sheet-b">
              <p className="muted bq-sh">{edit ? L('Il numero della riga non cambia.', 'Le numéro de la ligne ne change pas.')
                : L(`La riga riceve il numero ${Math.max(0, ...its.map((i) => i.line_no)) + 1} al salvataggio.`, `La ligne reçoit le numéro ${Math.max(0, ...its.map((i) => i.line_no)) + 1} à l'enregistrement.`)}
                {reason && draft ? ` ${L('Esiste una bozza di revisione: ciò che cambi qui non entra nella bozza.', 'Un brouillon de révision existe : ce que vous changez ici n\'entre pas dans le brouillon.')}` : ''}</p>
              <BudgetRowForm key={edit?.id ?? `new-${sp.n ?? ''}`} action={saveItem} lang={lang} year={year} budgetId={shown.id} ret={ret} cancelHref={close} item={edit}
                {...formProps} rate={c.rate} needReason={reason} defCat={lastCat} defPrj={lastPrj} />
              <p className="muted small bq-sh">{L('Manca un donatore o un fornitore nell\'elenco? Si aggiunge in ', 'Un donateur ou un fournisseur manque dans la liste ? Il s\'ajoute dans ')}
                <Link href="/controparti">{L('Movimenti › Controparti', 'Mouvements › Contreparties')}</Link>.</p>
            </div>
          </aside>
        </div>
      )}

      {delRow && (
        <div className="sheet-bg dl-sheet-bg">
          <Link className="dl-sheet-x" href={close} scroll={false} aria-label={L('Chiudi', 'Fermer')} />
          <aside className="sheet sheet-help dl-sheet aw-sheet bq-sheet" role="dialog" aria-modal="true" aria-label={L(`Elimina la riga n. ${delRow.line_no}`, `Supprimer la ligne n° ${delRow.line_no}`)}>
            <div className="sheet-h"><h2>{L(`Eliminare la riga n. ${delRow.line_no}?`, `Supprimer la ligne n° ${delRow.line_no} ?`)}</h2><div className="spacer" />
              <Link className="btn ghost" href={close} scroll={false}>{L('Chiudi', 'Fermer')}</Link></div>
            <div className="sheet-b">
              <dl className="bq-sum">
                <div><dt>{L('Codice', 'Code')}</dt><dd>{catLabel(delRow.category_id)}</dd></div>
                <div><dt>{L('Descrizione', 'Description')}</dt><dd>{delRow.description || '–'}</dd></div>
                <div><dt>{L('Progetto', 'Projet')}</dt><dd>{prjName(delRow.project_id)}</dd></div>
                <div><dt>{L('Totale', 'Total')}</dt><dd className="num">{m(delRow.amount_eur)}{delRow.currency !== 'EUR' ? ` · ${money(delRow.amount, delRow.currency, lang)}` : ''}</dd></div>
              </dl>
              <form action={deleteItem} className="fgrid bq-form">
                <input type="hidden" name="year" value={year} /><input type="hidden" name="id" value={delRow.id} /><input type="hidden" name="budget_id" value={shown.id} />
                <input type="hidden" name="ret" value={ret} />
                {reason && <div className="field span2"><label htmlFor="del-reason">{L('Motivo dell\'eliminazione (resta nello storico)', 'Motif de la suppression (reste dans l\'historique)')}</label>
                  <input className="input" id="del-reason" name="reason" required minLength={5} maxLength={500} placeholder={L('Es. voce annullata con delibera del…', 'Ex. poste annulé par délibération du…')} /></div>}
                <label className="check span2"><input type="checkbox" name="confirm" required /> {L('Confermo l\'eliminazione di questa riga', 'Je confirme la suppression de cette ligne')}</label>
                <div className="span2 bq-sub two">
                  <button className="btn danger" type="submit">{L('Elimina la riga', 'Supprimer la ligne')}</button>
                  <Link className="btn ghost" href={close} scroll={false}>{L('Annulla', 'Annuler')}</Link>
                </div>
              </form>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
