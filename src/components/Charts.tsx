import type { Lang } from '@/lib/i18n';

// Grafici in SVG disegnati sul server: niente librerie, leggibili anche senza JavaScript.
// Colori tenui: verde acqua per le entrate, blu notte per le uscite, lilla per i budget.
// colori come variabili del tema: contrasto corretto anche nel tema scuro (revisione del panel, A1-A2)
export const C_IN = 'var(--c-in)';
export const C_OUT = 'var(--c-out)';
export const C_BUDGET = 'var(--c-budget)';
export const C_OVER = 'var(--c-over)';

const short = (n: number, lang: Lang) =>
  new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'it-IT', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const full = (n: number, lang: Lang) =>
  new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
    useGrouping: 'always' } as Intl.NumberFormatOptions).format(n);

function niceMax(v: number) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  // massimi «tondi» divisibili per 4: tacche pulite (0, 1.000, 2.000…)
  return [1, 2, 4, 8, 10].map((k) => k * p).find((x) => x >= v) ?? v;
}

export function MonthBars({ data, lang, labels, hrefFor }: {
  data: { inc: number; out: number }[]; lang: Lang; labels: { in: string; out: string };
  hrefFor?: (month: number) => string;   // approfondimento: il mese apre i suoi movimenti
}) {
  const W = 560, H = 220, L = 46, B = 26, T = 10;
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.inc, d.out)), 0));
  const cw = (W - L) / 12, bw = Math.min(16, cw / 3);
  const y = (v: number) => T + (H - B - T) * (1 - v / max);
  const months = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'it-IT', { month: 'short' }).format(new Date(2026, i, 1)));
  return (
    <figure style={{ margin: 0 }}>
      <svg className="mbars" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${labels.in} / ${labels.out}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="var(--line-2)" />
            <text x={L - 6} y={y(max * f) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">{short(max * f, lang)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = L + i * cw + cw / 2;
          const bars = (
            <g key={i}>
              <rect x={x - bw - 1} y={y(d.inc)} width={bw} height={Math.max(0, y(0) - y(d.inc))} rx="3" fill={C_IN}>
                <title>{`${months[i]} · ${labels.in}: ${full(d.inc, lang)}`}</title></rect>
              <rect x={x + 1} y={y(d.out)} width={bw} height={Math.max(0, y(0) - y(d.out))} rx="3" fill={C_OUT}>
                <title>{`${months[i]} · ${labels.out}: ${full(d.out, lang)}`}</title></rect>
              <text x={x} y={H - 8} textAnchor="middle" fontSize="12" fill="var(--muted)">{months[i]}</text>
            </g>
          );
          if (!hrefFor || (!d.inc && !d.out)) return bars;
          return (
            <a key={i} href={hrefFor(i + 1)} className="mlink" aria-label={`${months[i]}: ${labels.in} ${full(d.inc, lang)}, ${labels.out} ${full(d.out, lang)}`}>
              <rect x={L + i * cw} y={T} width={cw} height={H - T} fill="transparent" />
              {bars}
            </a>
          );
        })}
      </svg>
      <figcaption className="legend">
        <span><i style={{ background: C_IN }} />{labels.in} <b className="num">{full(data.reduce((s, d) => s + d.inc, 0), lang)}</b></span>
        <span><i style={{ background: C_OUT }} />{labels.out} <b className="num">{full(data.reduce((s, d) => s + d.out, 0), lang)}</b></span>
      </figcaption>
    </figure>
  );
}

export function HBars({ rows, lang, color = C_OUT }: { rows: { label: string; value: number; href?: string }[]; lang: Lang; color?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div key={r.label} className="hbar">
          <span className="hl">{r.href ? <a href={r.href}>{r.label}</a> : r.label}</span>
          <span className="ht"><i style={{ width: `${(r.value / max) * 100}%`, background: color }} /></span>
          <span className="hv num">{full(r.value, lang)}</span>
        </div>
      ))}
    </div>
  );
}

// Barra di avanzamento sul budget: traccia lilla = budget, riempimento = speso, rosso oltre il budget.
export function BudgetBar({ budget, spent }: { budget: number; spent: number }) {
  const max = Math.max(budget, spent, 1);
  const over = budget > 0 && spent > budget;
  return (
    <span className="bbar" aria-hidden="true">
      <i className="bb" style={{ width: `${(budget / max) * 100}%`, background: C_BUDGET }} />
      <i className="bs" style={{ width: `${(Math.min(spent, budget || spent) / max) * 100}%`, background: C_OUT }} />
      {over && <i className="bs" style={{ left: `${(budget / max) * 100}%`, width: `${((spent - budget) / max) * 100}%`, background: C_OVER }} />}
      {budget > 0 && <i className="bm" style={{ left: `calc(${(budget / max) * 100}% - 2px)` }} />}
    </span>
  );
}
