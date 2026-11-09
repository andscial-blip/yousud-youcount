// Grafici di Cairn (src/legacy/app.ts: niceStep, axis, svgBars, svgLines, homeChart, donut, VZ), portati 1:1 in TypeScript.
// Restituiscono SVG come testo: si disegnano sul server, senza librerie. I suggerimenti al passaggio sono negli attributi
// data-tip (li mostra Tooltip). Ogni grafico ha una versione «telefono» stretta e alta invece di scorrere di lato.
import type { Lang } from './i18n';

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const loc = (lang: Lang) => (lang === 'fr' ? 'fr-FR' : 'it-IT');
export const eur0 = (v: number, lang: Lang = 'it') =>
  `${new Intl.NumberFormat(loc(lang), { maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions).format(Math.round(v))} €`;
export const kfmt = (v: number, lang: Lang = 'it') =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString(loc(lang), { maximumFractionDigits: 1 })}k` : String(Math.round(v));
export const MESI: Record<Lang, string[]> = {
  it: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'],
  fr: ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'],
};
export const MESI_L: Record<Lang, string[]> = {
  it: ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'],
  fr: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
};

export function niceStep(x: number) {
  if (!(x > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const n = x / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function axis(top: number, step: number, L: number, W: number, R: number, y: (v: number) => number, lang: Lang) {
  let g = '';
  for (let t = 0; t <= top + 0.1; t += step)
    g += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line-2)"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${t >= 1000 ? (t / 1000).toLocaleString(loc(lang)) + 'k' : Math.round(t)}</text>`;
  return g;
}

export type Series = { name: string; vals: number[]; color: string; dashed?: boolean[] };
export type Ref = { v: number; color: string; label?: string };

// Barre per categoria (mesi, anni): affiancate o impilate, con linee di riferimento tratteggiate.
export function svgBars(cats: string[], series: Series[], opt: { stacked?: boolean; labels?: boolean; refs?: Ref[]; min?: number; h?: number; label?: string; phone?: boolean; lang?: Lang; hrefs?: (string | null)[] } = {}) {
  const lang = opt.lang ?? 'it';
  const ph = !!opt.phone && cats.length <= 12;
  const W = ph ? 380 : 720, H = ph ? 260 : (opt.h ?? 260), L = ph ? 44 : 56, R = 10, T = 16, B = 30, n = cats.length, k = series.length;
  const tot = (i: number) => opt.stacked ? series.reduce((a, s) => a + Math.max(0, s.vals[i] || 0), 0) : Math.max(...series.map((s) => s.vals[i] || 0));
  const max = Math.max(opt.min ?? 1000, ...cats.map((_, i) => tot(i)), ...(opt.refs ?? []).map((r) => r.v));
  const step = niceStep(max / 4), top = Math.ceil(max / step) * step, sx = (W - L - R) / n;
  const y = (v: number) => T + (H - T - B) * (1 - v / top), hh = (v: number) => (H - T - B) * v / top;
  let out = axis(top, step, L, W, R, y, lang);
  cats.forEach((c, i) => {
    const gw = Math.min(sx * 0.7, opt.stacked ? 46 : 22 * series.length), x0 = L + sx * i + (sx - gw) / 2;
    let acc = 0;
    series.forEach((s, j) => {
      const v = s.vals[i] || 0;
      if (v <= 0) return;
      const st = s.dashed && s.dashed[i];
      if (opt.stacked) {
        out += `<rect x="${x0}" y="${y(acc + v)}" width="${gw}" height="${hh(v)}" fill="${st ? 'var(--band)' : s.color}" ${st ? `stroke="${s.color}" stroke-dasharray="3 2"` : ''}></rect>`;
        acc += v;
      } else {
        const bw = gw / k;
        out += `<rect x="${x0 + bw * j + 1}" y="${y(v)}" width="${bw - 2}" height="${hh(v)}" fill="${st ? 'var(--band)' : s.color}" ${st ? `stroke="${s.color}" stroke-dasharray="3 2"` : ''} rx="2"></rect>`;
        if (opt.labels) out += `<text class="vl" x="${x0 + bw * j + bw / 2}" y="${y(v) - 4}" text-anchor="middle" font-size="10" fill="var(--muted)">${kfmt(v, lang)}</text>`;
      }
    });
    if (opt.stacked && opt.labels && acc > 0) out += `<text class="vl" x="${x0 + gw / 2}" y="${y(acc) - 5}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--muted)">${kfmt(acc, lang)}</text>`;
    const tl = [c]; let sum = 0;
    series.forEach((s) => { const v = s.vals[i] || 0; if (v > 0) { tl.push(`${s.name}: ${eur0(v, lang)}`); sum += v; } });
    if (opt.stacked && tl.length > 2) tl.push(`${lang === 'fr' ? 'Total' : 'Totale'}: ${eur0(sum, lang)}`);
    if (tl.length === 1) tl.push('—');
    const hov = `<rect class="hov" x="${L + sx * i}" y="${T}" width="${sx}" height="${H - T - B}" data-tip="${esc(tl.join('\n'))}"></rect>`;
    const href = opt.hrefs?.[i];
    out += href && sum > 0 ? `<a href="${esc(href)}" aria-label="${esc(tl.join(', '))}">${hov}</a>` : hov;
    out += `<text x="${L + sx * i + sx / 2}" y="${H - 9}" text-anchor="middle" font-size="11.5" fill="var(--muted)">${esc(c)}</text>`;
  });
  (opt.refs ?? []).forEach((r) => {
    out += `<line x1="${L}" x2="${W - R}" y1="${y(r.v)}" y2="${y(r.v)}" stroke="${r.color}" stroke-dasharray="5 4" stroke-width="1.5"/>${r.label ? `<text class="ref" x="${W - R}" y="${y(r.v) - 5}" text-anchor="end" font-size="11" fill="${r.color}">${esc(r.label)}</text>` : ''}`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label ?? '')}" tabindex="0" data-kbd="1">${out}</svg>`;
}

// Linee (cumulati, andamenti), con area tenue facoltativa e punto sull'ultimo valore.
export function svgLines(cats: string[], series: (Series & { area?: boolean; dash?: string; w?: number; vals: (number | null)[] })[], opt: { refs?: Ref[]; h?: number; label?: string; phone?: boolean; lang?: Lang } = {}) {
  const lang = opt.lang ?? 'it';
  const ph = !!opt.phone && cats.length <= 24;
  const W = ph ? 380 : 720, H = ph ? 240 : (opt.h ?? 260), L = ph ? 44 : 56, R = 12, T = 16, B = 30, n = cats.length;
  const vals = series.flatMap((s) => s.vals.filter((v): v is number => v != null));
  const max = Math.max(1000, ...vals, ...(opt.refs ?? []).map((r) => r.v));
  const step = niceStep(max / 4), top = Math.ceil(max / step) * step, sx = (W - L - R) / (n - 1 || 1);
  const y = (v: number) => T + (H - T - B) * (1 - v / top), x = (i: number) => L + sx * i;
  let out = axis(top, step, L, W, R, y, lang);
  (opt.refs ?? []).forEach((r) => { out += `<line x1="${L}" x2="${W - R}" y1="${y(r.v)}" y2="${y(r.v)}" stroke="${r.color}" stroke-dasharray="5 4" stroke-width="1.5"/>${r.label ? `<text class="ref" x="${L + 6}" y="${y(r.v) - 5}" font-size="11" fill="${r.color}">${esc(r.label)}</text>` : ''}`; });
  series.forEach((s) => {
    const pts = s.vals.map((v, i) => (v == null ? null : [x(i), y(v)] as const));
    let d = '';
    pts.forEach((p, i) => { if (!p) return; d += (d && pts[i - 1] ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); });
    if (s.area) { const idx = pts.map((p, i) => (p ? i : -1)).filter((i) => i >= 0); if (idx.length) out += `<path d="${d}L${x(idx[idx.length - 1]!)} ${y(0)}L${x(idx[0]!)} ${y(0)}Z" fill="${s.color}" opacity=".12"/>`; }
    out += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.w ?? 2.4}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round"/>`;
    const li = s.vals.map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0).pop();
    if (li != null && li >= 0) out += `<circle cx="${x(li)}" cy="${y(s.vals[li]!)}" r="4" fill="${s.color}"></circle>`;
  });
  cats.forEach((c, i) => {
    const tl = [c]; series.forEach((s) => { if (s.vals[i] != null) tl.push(`${s.name}: ${eur0(s.vals[i]!, lang)}`); });
    const w = sx || W - L - R;
    out += `<rect class="hov" x="${Math.max(L, x(i) - w / 2)}" y="${T}" width="${w}" height="${H - T - B}" data-tip="${esc(tl.join('\n'))}"></rect>`;
  });
  const every = ph && n > 8 ? 2 : 1;
  cats.forEach((c, i) => { if (i % every && i !== n - 1) return; const a = i === n - 1 && n > 1 ? 'end' : 'middle'; out += `<text x="${i === n - 1 && n > 1 ? x(i) + 4 : x(i)}" y="${H - 9}" text-anchor="${a}" font-size="11.5" fill="var(--muted)">${esc(c)}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label ?? '')}" tabindex="0" data-kbd="1">${out}</svg>`;
}

// Grafico mensile della dashboard di Cairn (homeChart): tre strati impilati, mese corrente evidenziato, valore sopra la barra.
export function monthChart(a: number[], b: number[], c: number[], curM: number, names: [string, string, string], lang: Lang, W = 720, compact = false, hrefs?: (string | null)[]) {
  const H = compact ? 210 : 240, L = compact ? 30 : 34, R = 6, T = 24, B = 28;
  const tot = a.map((v, i) => v + (b[i] ?? 0) + (c[i] ?? 0)), max = Math.max(1000, ...tot);
  const step = niceStep(max / 3), top = Math.ceil(max / step) * step, sx = (W - L - R) / 12, bw = Math.min(34, sx * (compact ? 0.64 : 0.6));
  const y = (v: number) => T + (H - T - B) * (1 - v / top), hh = (v: number) => (H - T - B) * v / top;
  const M = MESI[lang], ML = MESI_L[lang];
  let g = '';
  for (let t = step; t <= top + 0.1; t += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line-2)" stroke-dasharray="2 4"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="var(--faint)">${kfmt(t, lang)}</text>`;
  const seg = (x: number, y0: number, h: number, col: string, round: boolean) => {
    if (h <= 0) return '';
    const r = round ? Math.min(6, h, bw / 2) : 0;
    return r ? `<path d="M${x} ${y0 + h}V${y0 + r}Q${x} ${y0} ${x + r} ${y0}H${x + bw - r}Q${x + bw} ${y0} ${x + bw} ${y0 + r}V${y0 + h}Z" fill="${col}"/>` : `<rect x="${x}" y="${y0}" width="${bw}" height="${h}" fill="${col}"/>`;
  };
  let bars = '';
  a.forEach((v, i) => {
    const x = L + sx * i + (sx - bw) / 2, t = tot[i]!, bi = b[i] ?? 0, ci = c[i] ?? 0;
    const tl = [ML[i]!]; if (v) tl.push(`${names[0]}: ${eur0(v, lang)}`); if (bi) tl.push(`${names[1]}: ${eur0(bi, lang)}`); if (ci) tl.push(`${names[2]}: ${eur0(ci, lang)}`); if (tl.length === 1) tl.push('—');
    if (i === curM) bars += `<rect x="${L + sx * i + 2}" y="${T - 18}" width="${sx - 4}" height="${H - T - B + 18 + 22}" rx="10" fill="var(--surface-2)"/>`;
    bars += seg(x, y(v), hh(v), 'var(--vz-real)', !bi && !ci) + seg(x, y(v + bi), hh(bi), 'var(--vz-plan)', !ci) + seg(x, y(t), hh(ci), 'var(--vz-hyp)', true);
    if (t > 0 && !compact) bars += `<text x="${x + bw / 2}" y="${y(t) - 6}" text-anchor="middle" font-size="11" font-weight="600" fill="${!v && !bi ? 'var(--lilac-ink)' : 'var(--muted)'}">${kfmt(t, lang)}</text>`;
    bars += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="${compact ? 10.5 : 11.5}" font-weight="${i === curM ? 700 : 500}" fill="${i === curM ? 'var(--fg)' : 'var(--faint)'}">${M[i]}</text>`;
    const hov = `<rect class="hov" x="${L + sx * i}" y="${T - 18}" width="${sx}" height="${H - T - B + 18}" data-tip="${esc(tl.join('\n'))}"></rect>`;
    const href = hrefs?.[i];
    bars += href && t > 0 ? `<a href="${esc(href)}" aria-label="${esc(tl.join(', '))}">${hov}</a>` : hov;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(names[0])}" tabindex="0" data-kbd="1">${g}<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)"/>${bars}</svg>`;
}

// Ciambella (allocazione) con il totale al centro.
export function donut(items: { label: string; value: number; color: string; tip?: string }[], center: { label: string; value: string }) {
  const R = 74, Wd = 26, C = 2 * Math.PI * R;
  const tot = items.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  let acc = 0;
  const seg = items.filter((x) => x.value > 0).map((t) => {
    const f = t.value / tot;
    const s = `<circle cx="100" cy="100" r="${R}" fill="none" stroke="${t.color}" stroke-width="${Wd}" stroke-dasharray="${Math.max(0, f * C - 1.5).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-acc * C).toFixed(2)}" transform="rotate(-90 100 100)" data-tip="${esc(t.tip ?? t.label)}"></circle>`;
    acc += f; return s;
  }).join('');
  return `<svg class="donut" viewBox="0 0 200 200" role="img" aria-label="${esc(center.label)}"><circle cx="100" cy="100" r="${R}" fill="none" stroke="var(--line-2)" stroke-width="${Wd}"/>${seg}<text x="100" y="94" text-anchor="middle" font-size="11" fill="var(--muted)">${esc(center.label)}</text><text x="100" y="114" text-anchor="middle" font-size="19" font-weight="700" fill="var(--navy)">${esc(center.value)}</text></svg>`;
}

// Mini grafici dei riquadri numerici (VZ di Cairn).
export const VZ = {
  ring: (p: number, col: string, tip = '') => {
    const r = 19, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, p));
    return `<svg class="vzr" viewBox="0 0 46 46" data-tip="${esc(tip)}"><circle cx="23" cy="23" r="${r}" fill="none" stroke="var(--line-2)" stroke-width="6"/><circle cx="23" cy="23" r="${r}" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(v * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 23 23)"/></svg>`;
  },
  stack: (segs: { v: number; c: string }[], max: number, marks: { v: number; c: string; dash?: boolean }[] = [], tip = '') => {
    let x = 0, out = '';
    const W = 200, sc = (v: number) => (max > 0 ? (v / max) * W : 0);
    segs.forEach((g) => { const w = sc(Math.max(0, g.v)); if (w > 0.5) out += `<rect x="${x.toFixed(1)}" y="10" width="${Math.max(0, w - 1).toFixed(1)}" height="14" rx="3" fill="${g.c}"></rect>`; x += w; });
    marks.forEach((m) => { const mx = Math.min(W, sc(m.v)); out += `<line x1="${mx}" x2="${mx}" y1="4" y2="30" stroke="${m.c}" stroke-width="1.6" stroke-dasharray="${m.dash ? '2 2' : '0'}"/>`; });
    return `<svg class="vz" viewBox="0 0 200 34" preserveAspectRatio="none" data-tip="${esc(tip)}"><rect x="0" y="10" width="200" height="14" rx="3" fill="var(--surface-2)"/>${out}</svg>`;
  },
  cols: (vals: number[], hi: number[], tip = '', colorFn?: (i: number) => string) => {
    const n = vals.length;
    if (!n || !vals.some((v) => v)) return '';
    const mx = Math.max(1, ...vals.map((v) => Math.abs(v || 0))), bw = 200 / n;
    let out = '';
    vals.forEach((v, i) => { const h = Math.max(1.5, (Math.abs(v || 0) / mx) * 30); out += `<rect x="${(i * bw + bw * 0.18).toFixed(1)}" y="${(32 - h).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${colorFn ? colorFn(i) : hi.includes(i) ? 'var(--c-ink)' : 'var(--band)'}"></rect>`; });
    return `<svg class="vz" viewBox="0 0 200 34" preserveAspectRatio="none" data-tip="${esc(tip)}">${out}</svg>`;
  },
  bars2: (rows: { v: number; c: string }[], tip = '') => {
    const mx = Math.max(1, ...rows.map((r) => r.v));
    return `<svg class="vz" viewBox="0 0 200 34" preserveAspectRatio="none" data-tip="${esc(tip)}">${rows.slice(0, 2).map((r, i) => `<rect x="0" y="${3 + i * 16}" width="${Math.max(2, (r.v / mx) * 200).toFixed(1)}" height="11" rx="3" fill="${r.c}"></rect>`).join('')}</svg>`;
  },
};
