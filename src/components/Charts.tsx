import type { Lang } from '@/lib/i18n';
import { donut, eur0, flowMini, MESI, monthChart, svgBars, svgLines, svgMirror, VZ, type Ref, type Series } from '@/lib/viz';

// Componenti grafici con gli stessi disegni di Cairn (src/lib/viz.ts). Sul computer la versione larga,
// sul telefono quella stretta e alta (si sceglie con il CSS, nessun JavaScript).
// Colori con lo stesso significato di Cairn: blu notte = reale, blu = previsto, lilla = ipotesi,
// giallo = spese, verde acqua = netto, salmone = oltre il limite.
export const C_IN = 'var(--c-in)';   // entrate: verde della palette
export const C_OUT = 'var(--c-out)'; // uscite: rosso tenue della palette
export const C_PLAN = 'var(--vz-plan)';
export const C_HYP = 'var(--vz-hyp)';
export const C_NET = 'var(--green-soft)';
export const C_OVER = 'var(--tax)';
export const C_BUDGET = 'var(--band)';
export const PAL = ['var(--dn1)', 'var(--dn2)', 'var(--dn3)', 'var(--dn4)', 'var(--dn5)', 'var(--dn6)'];

const Svg = ({ html, className }: { html: string; className?: string }) =>
  <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;

export function Legend({ items, className = '' }: { items: { label: string; color: string; value?: string; dashed?: boolean; line?: boolean }[]; className?: string }) {
  return (
    <div className={`legend ${className}`}>
      {items.map((x) => (
        <span key={x.label}>
          <i style={x.line ? { background: 'none', height: 0, width: 16, borderRadius: 0, borderTop: `2px dashed ${x.color}`, verticalAlign: 3 }
            : x.dashed ? { background: 'var(--band)', border: `1px dashed ${x.color}` } : { background: x.color }} />
          {x.label}{x.value && <b className="num">{x.value}</b>}
        </span>
      ))}
    </div>
  );
}

// Barre per mese o per anno (affiancate o impilate).
export function Bars({ cats, series, lang, stacked, labels, refs, label, h, hrefs }: {
  cats: string[]; series: Series[]; lang: Lang; stacked?: boolean; labels?: boolean; refs?: Ref[]; label?: string; h?: number; hrefs?: (string | null)[];
}) {
  return (
    <div className="chart-wrap">
      <Svg className="ch-d" html={svgBars(cats, series, { stacked, labels, refs, label, h, lang, hrefs })} />
      <Svg className="ch-m" html={svgBars(cats, series, { stacked, labels: false, refs, label, lang, hrefs, phone: true })} />
    </div>
  );
}

export function Lines({ cats, series, lang, refs, label, h, zoom, unit }: {
  cats: string[]; series: (Series & { area?: boolean; dash?: string; w?: number; vals: (number | null)[] })[]; lang: Lang; refs?: Ref[]; label?: string; h?: number;
  zoom?: boolean; unit?: string;
}) {
  const fmt = unit ? (v: number) => `${v.toLocaleString(lang === 'fr' ? 'fr-FR' : 'it-IT', { maximumFractionDigits: 2, useGrouping: 'always' } as Intl.NumberFormatOptions)}\u00a0${unit}` : undefined;
  return (
    <div className="chart-wrap">
      <Svg className="ch-d" html={svgLines(cats, series, { refs, label, h, lang, zoom, fmt })} />
      <Svg className="ch-m" html={svgLines(cats, series, { refs, label, lang, phone: true, zoom, fmt })} />
    </div>
  );
}

// Grafico mensile della dashboard (come «Il tuo 2026» di Cairn): reale, previsto e ipotesi impilati.
export function MonthChart({ a, b, c, curM, names, lang, hrefs }: {
  a: number[]; b: number[]; c: number[]; curM: number; names: [string, string, string]; lang: Lang; hrefs?: (string | null)[];
}) {
  return (
    <div className="hero-chart chart">
      <Svg className="hc-d" html={monthChart(a, b, c, curM, names, lang, 720, false, hrefs)} />
      <Svg className="hc-m" html={monthChart(a, b, c, curM, names, lang, 380, true, hrefs)} />
    </div>
  );
}

// Entrate e uscite per mese: istogramma a specchio (entrate sopra, uscite sotto, pallino del saldo); solo entrate → barre semplici.
export function MonthBars({ data, lang, labels, hrefFor }: {
  data: { inc: number; out: number }[]; lang: Lang; labels: { in: string; out: string }; hrefFor?: (month: number) => string;
}) {
  const tin = data.reduce((s, d) => s + d.inc, 0), tout = data.reduce((s, d) => s + d.out, 0);
  const hrefs = hrefFor ? data.map((_, i) => hrefFor(i + 1)) : undefined;
  if (!labels.out || !data.some((d) => d.out > 0)) return (
    <figure style={{ margin: 0 }}>
      <Bars cats={MESI[lang]} lang={lang} label={labels.in} series={[{ name: labels.in, vals: data.map((d) => d.inc), color: C_IN }]} hrefs={hrefs} />
      <figcaption><Legend className="under" items={[{ label: labels.in, color: C_IN, value: eur0(tin, lang) }]} /></figcaption>
    </figure>
  );
  const net = lang === 'fr' ? 'Solde' : 'Saldo', names: [string, string, string] = [labels.in, labels.out, net];
  const inc = data.map((d) => d.inc), out = data.map((d) => d.out), cats = MESI[lang], tn = tin - tout;
  return (
    <figure style={{ margin: 0 }}>
      <div className="chart-wrap">
        <Svg className="ch-d" html={svgMirror(cats, inc, out, { label: `${labels.in} / ${labels.out}`, lang, hrefs, names })} />
        <Svg className="ch-m" html={svgMirror(cats, inc, out, { label: `${labels.in} / ${labels.out}`, lang, hrefs, names, phone: true })} />
      </div>
      <figcaption><Legend className="under trio" items={[{ label: labels.in, color: C_IN, value: eur0(tin, lang) }, { label: labels.out, color: C_OUT, value: eur0(tout, lang) },
        { label: net, color: 'var(--c-net)', value: `${tn < 0 ? '\u2212' : ''}${eur0(Math.abs(tn), lang)}` }]} /></figcaption>
    </figure>
  );
}

// Dashboard: entrate sopra e uscite sotto per mese, nel disegno essenziale della scheda «Entrate e uscite» di Cairn.
export function FlowMini({ data, curM, lang, names, hrefFor }: {
  data: { inc: number; out: number }[]; curM: number; lang: Lang; names: [string, string, string]; hrefFor?: (month: number) => string;
}) {
  return <figure className="hflow chart"><Svg html={flowMini(data, curM, lang, names, hrefFor ? data.map((_, i) => hrefFor(i + 1)) : undefined)} /></figure>;
}

// Elenco a barre orizzontali (come «Dove vanno le spese» / righe .cbar di Cairn), con percentuale sul totale.
// many: ogni riga con un colore diverso della palette (categorie, controparti); altrimenti un solo colore
// un solo colore per elenco (blu ardesia, verde delle entrate o rosso tenue delle uscite): il confronto è sulla lunghezza, non sul colore
export function HBars({ rows, lang, color = 'var(--c-net)', total }: { rows: { label: string; value: number; href?: string; color?: string }[]; lang: Lang; color?: string; total?: number; many?: boolean }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const tot = total ?? rows.reduce((s, r) => s + r.value, 0);
  // nome e importo su una riga (il nome va a capo, mai troncato), barra sotto
  return (
    <ul className="hcat pbars">
      {rows.map((r) => (
        <li key={r.label}>{r.href ? <a className="hc-n" href={r.href}>{r.label}</a> : <span className="hc-n">{r.label}</span>}
          <b className="num">{eur0(r.value, lang)}{tot > 0 && <small>{Math.round((r.value / tot) * 100)}{'\u00a0'}%</small>}</b>
          <span className="hc-b"><i style={{ width: `${((r.value / max) * 100).toFixed(1)}%`, background: r.color ?? color }} /></span></li>
      ))}
    </ul>
  );
}

// Striscia proporzionale (come «Dove vanno le spese» di Cairn) con legenda sotto.
export function ShareStrip({ rows, lang }: { rows: { label: string; value: number; color: string }[]; lang: Lang }) {
  const tot = rows.reduce((s, r) => s + Math.max(0, r.value), 0) || 1;
  return (
    <div className="hbar" role="img" aria-label={rows.map((r) => `${r.label} ${eur0(r.value, lang)}`).join(', ')}>
      {rows.filter((r) => r.value > 0).map((r) => (
        <i key={r.label} style={{ width: `${(r.value / tot) * 100}%`, background: r.color }} data-tip={`${r.label}: ${eur0(r.value, lang)} (${Math.round((r.value / tot) * 100)}%)`} />
      ))}
    </div>
  );
}

export function Donut({ items, center }: { items: { label: string; value: number; color: string; tip?: string }[]; center: { label: string; value: string } }) {
  return <Svg html={donut(items, center)} />;
}

// Mini grafici dei riquadri numerici.
export const Viz = {
  Stack: (p: { segs: { v: number; c: string }[]; max: number; marks?: { v: number; c: string; dash?: boolean }[]; tip?: string }) =>
    <Svg html={VZ.stack(p.segs, p.max, p.marks, p.tip)} />,
  Cols: (p: { vals: number[]; hi?: number[]; tip?: string; colors?: string[] }) =>
    <Svg html={VZ.cols(p.vals, p.hi ?? [], p.tip, p.colors ? (i) => p.colors![i] ?? 'var(--band)' : undefined)} />,
  Ring: (p: { p: number; color: string; tip?: string }) => <Svg html={VZ.ring(p.p, p.color, p.tip)} />,
};

// Barra di avanzamento sul budget: traccia = preventivo, riempimento = speso, salmone oltre il preventivo.
export function BudgetBar({ budget, spent }: { budget: number; spent: number }) {
  const max = Math.max(budget, spent, 1);
  const over = budget > 0 && spent > budget;
  return (
    <span className="bbar" aria-hidden="true">
      <i className="bb" style={{ width: `${(budget / max) * 100}%`, background: C_BUDGET }} />
      <i className="bs" style={{ width: `${(Math.min(spent, budget || spent) / max) * 100}%`, background: 'var(--c-ink)', borderRadius: 5 }} />
      {over && <i className="bs" style={{ left: `${(budget / max) * 100}%`, width: `${((spent - budget) / max) * 100}%`, background: C_OVER }} />}
      {budget > 0 && <i className="bm" style={{ left: `calc(${(budget / max) * 100}% - 1px)` }} />}
    </span>
  );
}
