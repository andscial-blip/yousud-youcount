// Miglioramento delle foto dei giustificativi, tutto nel browser (nessuna IA generativa, nessun invio esterno):
// 1) trova i bordi del foglio, 2) raddrizza la prospettiva, 3) toglie le ombre e aumenta il contrasto.
// Funzioni pure su pixel RGBA, così si possono collaudare anche fuori dal browser. L'originale si conserva sempre.

export type Pt = { x: number; y: number };
export type Img = { data: Uint8ClampedArray; width: number; height: number };

const lum = (d: Uint8ClampedArray, i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

// ridimensiona (media su blocchi) per lavorare veloce sul rilevamento
export function downscale(img: Img, maxSide: number): { img: Img; scale: number } {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  if (scale === 1) return { img, scale };
  const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1, Math.floor(x / scale)), sy = Math.min(img.height - 1, Math.floor(y / scale));
      const si = (sy * img.width + sx) * 4, di = (y * w + x) * 4;
      out[di] = img.data[si]; out[di + 1] = img.data[si + 1]; out[di + 2] = img.data[si + 2]; out[di + 3] = 255;
    }
  }
  return { img: { data: out, width: w, height: h }, scale };
}

function otsu(values: Float32Array) {
  const hist = new Array(256).fill(0);
  for (const v of values) hist[Math.max(0, Math.min(255, Math.round(v)))]++;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; thr = t; }
  }
  return thr;
}

// Riduzione con media a blocchi (meno rumore della semplice campionatura)
export function shrink(img: Img, maxSide: number): { img: Img; scale: number } {
  const f = Math.max(1, Math.ceil(Math.max(img.width, img.height) / maxSide));
  if (f === 1) return { img, scale: 1 };
  const w = Math.floor(img.width / f), h = Math.floor(img.height / f);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
      const i = ((y * f + dy) * img.width + x * f + dx) * 4;
      r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2];
    }
    const o = (y * w + x) * 4, n = f * f;
    out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
  }
  return { img: { data: out, width: w, height: h }, scale: 1 / f };
}

function cross(o: Pt, a: Pt, b: Pt) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const lo: Pt[] = [], up: Pt[] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const tri = (a: Pt, b: Pt, c: Pt) => Math.abs(cross(a, b, c)) / 2;

// Quadrilatero di area massima con i vertici sull'involucro convesso (O(n³) su al più 64 punti)
function maxQuad(h: Pt[]): Pt[] {
  let pts = h;
  if (pts.length > 64) { const step = pts.length / 64; pts = Array.from({ length: 64 }, (_, i) => h[Math.floor(i * step)]); }
  const n = pts.length;
  if (n < 4) return [];
  let best = -1, q: Pt[] = [];
  for (let i = 0; i < n; i++) for (let k = i + 2; k < n; k++) {
    let bj = -1, aj = -1, bl = -1, al = -1;
    for (let j = i + 1; j < k; j++) { const t = tri(pts[i], pts[j], pts[k]); if (t > aj) { aj = t; bj = j; } }
    for (let l = k + 1; l < n + i; l++) { const t = tri(pts[k], pts[l % n], pts[i]); if (t > al) { al = t; bl = l % n; } }
    if (bj >= 0 && bl >= 0 && aj + al > best) { best = aj + al; q = [pts[i], pts[bj], pts[k], pts[bl]]; }
  }
  return q;
}

// ordina in alto-sinistra, alto-destra, basso-destra, basso-sinistra
function order(q: Pt[]): Pt[] {
  const c = { x: q.reduce((s, p) => s + p.x, 0) / 4, y: q.reduce((s, p) => s + p.y, 0) / 4 };
  const byAngle = [...q].sort((a, b) => Math.atan2(a.y - c.y, a.x - c.x) - Math.atan2(b.y - c.y, b.x - c.x));
  let start = 0;
  byAngle.forEach((p, i) => { if (p.x + p.y < byAngle[start].x + byAngle[start].y) start = i; });
  return [0, 1, 2, 3].map((i) => byAngle[(start + i) % 4]);
}

// Regione più grande sopra la soglia "alta", allargata per isteresi fino alla soglia "bassa"
function region(P: Float32Array, w: number, h: number, high: number, low: number): number[] {
  const seen = new Uint8Array(w * h);
  let best: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || P[start] <= high) continue;
    const pix: number[] = [];
    stack.push(start); seen[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      pix.push(p);
      const x = p % w, y = (p - x) / w;
      if (x > 0 && !seen[p - 1] && P[p - 1] > low) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && !seen[p + 1] && P[p + 1] > low) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && !seen[p - w] && P[p - w] > low) { seen[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && !seen[p + w] && P[p + w] > low) { seen[p + w] = 1; stack.push(p + w); }
    }
    if (pix.length > best.length) best = pix;
  }
  return best;
}

// quadrilatero dal contorno della regione
function quadOf(pix: number[], w: number, h: number): Pt[] {
  const inR = new Uint8Array(w * h);
  for (const p of pix) inR[p] = 1;
  const edge: Pt[] = [];
  for (const p of pix) {
    const x = p % w, y = (p - x) / w;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !inR[p - 1] || !inR[p + 1] || !inR[p - w] || !inR[p + w]) edge.push({ x: x + 0.5, y: y + 0.5 });
  }
  const q = maxQuad(hull(edge));
  return q.length === 4 ? order(q) : [];
}

// Un foglio fotografato resta un quadrilatero "quasi rettangolo": angoli tra 60° e 120°, lati opposti simili,
// area tra l'8% e il 97% della foto, e la regione deve riempire bene il quadrilatero.
// Ogni lato deve stare su un bordo vero (salto di luminosità tra dentro e fuori), non su una sfumatura d'ombra.
function edgeSupport(q: Pt[], L: Float32Array, w: number, h: number): number {
  const c = { x: q.reduce((s, p) => s + p.x, 0) / 4, y: q.reduce((s, p) => s + p.y, 0) / 4 };
  const at = (x: number, y: number) => L[Math.min(h - 1, Math.max(0, Math.round(y))) * w + Math.min(w - 1, Math.max(0, Math.round(x)))];
  const sides: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (nx * (mx - c.x) + ny * (my - c.y) < 0) { nx = -nx; ny = -ny; }   // normale verso l'esterno
    let sum = 0, n = 0;
    for (let k = 1; k < 20; k++) {
      const t = 0.1 + 0.8 * (k / 20), x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      const ox = x + nx * 3, oy = y + ny * 3;
      if (ox < 0 || oy < 0 || ox >= w || oy >= h) continue;   // lato sul bordo della foto: non conta
      sum += Math.abs(at(x - nx * 3, y - ny * 3) - at(ox, oy)); n++;
    }
    if (n >= 5) sides.push(sum / n);
  }
  if (!sides.length) return 1;
  const mx = Math.max(...sides), mn = Math.min(...sides);
  return mn >= 6 && mn >= 0.4 * mx ? 1 : 0;
}

function plausible(q: Pt[], w: number, h: number, filled: number, L: Float32Array): number {
  if (q.length !== 4) return 0;
  if (!edgeSupport(q, L, w, h)) return 0;
  const area = tri(q[0], q[1], q[2]) + tri(q[0], q[2], q[3]);
  const frac = area / (w * h);
  if (frac < 0.08 || frac > 0.97) return 0;
  for (let i = 0; i < 4; i++) {
    const a = q[(i + 3) % 4], b = q[i], c = q[(i + 1) % 4];
    const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
    const ang = Math.acos((v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y))) * 180 / Math.PI;
    if (ang < 60 || ang > 120) return 0;
  }
  const d = (u: Pt, v: Pt) => Math.hypot(u.x - v.x, u.y - v.y);
  const r1 = d(q[0], q[1]) / d(q[3], q[2]), r2 = d(q[0], q[3]) / d(q[1], q[2]);
  if (r1 < 0.7 || r1 > 1.43 || r2 < 0.7 || r2 > 1.43) return 0;
  const fill = filled / area;
  if (fill < 0.85) return 0;
  return area * fill;
}

// Angoli del foglio. Il foglio è chiaro e poco colorato rispetto al tavolo: si provano più criteri
// (luminosità meno saturazione, sola luminosità; con e senza isteresi per la parte in ombra) e si tiene il
// quadrilatero plausibile più grande. Se nessuno convince: tutta la foto con un piccolo margine.
// Gli angoli restano sempre spostabili a mano.
export function detectCorners(full: Img): Pt[] {
  const { img, scale } = shrink(full, 360);
  const { width: w, height: h, data } = img;
  const PL = new Float32Array(w * h), PS = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    PL[i] = lum(data, i * 4);
    PS[i] = Math.max(0, PL[i] - 0.7 * (Math.max(r, g, b) - Math.min(r, g, b)));
  }
  let best: Pt[] = [], bestScore = 0;
  for (const P of [PS, PL]) {
    const thr = otsu(P);
    let bgSum = 0, bgN = 0;
    for (const v of P) if (v <= thr) { bgSum += v; bgN++; }
    const bgMean = bgN ? bgSum / bgN : 0;
    for (const low of [thr, bgMean * 0.45 + thr * 0.55]) {
      const pix = region(P, w, h, thr, low);
      const q = quadOf(pix, w, h);
      const score = plausible(q, w, h, pix.length, PL);
      if (score > bestScore) { bestScore = score; best = q; }
    }
  }
  if (!best.length) {
    const mx = full.width * 0.02, my = full.height * 0.02;
    return [{ x: mx, y: my }, { x: full.width - mx, y: my }, { x: full.width - mx, y: full.height - my }, { x: mx, y: full.height - my }];
  }
  return best.map((p) => ({ x: Math.min(full.width, Math.max(0, p.x / scale)), y: Math.min(full.height, Math.max(0, p.y / scale)) }));
}

// Omografia che porta il rettangolo di arrivo (0,0)-(W,H) sul quadrilatero di partenza.
export function homography(src: Pt[], W: number, H: number): number[] {
  const dst = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = dst[i], { x: u, y: v } = src[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  // eliminazione di Gauss 8x8
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  return [...A.map((r, i) => r[8] / r[i]), 1];
}

// Restringe il quadrilatero verso il centro (f = 0,006 → 0,6%): niente filetti di tavolo sui bordi.
export function inset(q: Pt[], f = 0.006): Pt[] {
  const c = { x: q.reduce((s, p) => s + p.x, 0) / q.length, y: q.reduce((s, p) => s + p.y, 0) / q.length };
  return q.map((p) => ({ x: p.x + (c.x - p.x) * f * 2, y: p.y + (c.y - p.y) * f * 2 }));
}

export const applyH = (Hm: number[], x: number, y: number): Pt => {
  const d = Hm[6] * x + Hm[7] * y + Hm[8];
  return { x: (Hm[0] * x + Hm[1] * y + Hm[2]) / d, y: (Hm[3] * x + Hm[4] * y + Hm[5]) / d };
};

// Raddrizza il quadrilatero in un rettangolo (lato lungo al massimo maxSide), con interpolazione bilineare.
export function warp(img: Img, quad: Pt[], maxSide = 1800): Img {
  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  let W = Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2]));
  let H = Math.max(dist(quad[0], quad[3]), dist(quad[1], quad[2]));
  const k = Math.min(1, maxSide / Math.max(W, H));
  W = Math.max(1, Math.round(W * k)); H = Math.max(1, Math.round(H * k));
  const Hm = homography(quad, W, H);
  const out = new Uint8ClampedArray(W * H * 4);
  const { data, width, height } = img;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = applyH(Hm, x + 0.5, y + 0.5);
      const sx = Math.min(width - 1.001, Math.max(0, p.x - 0.5)), sy = Math.min(height - 1.001, Math.max(0, p.y - 0.5));
      const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * width + x0) * 4, i10 = i00 + 4, i01 = i00 + width * 4, i11 = i01 + 4;
      const o = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        out[o + c] = (data[i00 + c] * (1 - fx) + data[i10 + c] * fx) * (1 - fy) + (data[i01 + c] * (1 - fx) + data[i11 + c] * fx) * fy;
      }
      out[o + 3] = 255;
    }
  }
  return { data: out, width: W, height: H };
}

// Filtro del massimo (o minimo) su una finestra quadrata, separabile: righe poi colonne.
function rankFilter(src: Float32Array, w: number, h: number, r: number, max: boolean): Float32Array {
  const pick = max ? Math.max : Math.min;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = src[y * w + x];
    for (let d = Math.max(0, x - r); d <= Math.min(w - 1, x + r); d++) v = pick(v, src[y * w + d]);
    tmp[y * w + x] = v;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = tmp[y * w + x];
    for (let d = Math.max(0, y - r); d <= Math.min(h - 1, y + r); d++) v = pick(v, tmp[d * w + x]);
    out[y * w + x] = v;
  }
  return out;
}
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) { let s = 0, n = 0;
    for (let x = -r; x < w + r; x++) {
      if (x + r < w && x + r >= 0) { s += src[y * w + x + r]; n++; }
      if (x - r - 1 >= 0) { s -= src[y * w + x - r - 1]; n--; }
      if (x >= 0 && x < w) tmp[y * w + x] = s / n;
    } }
  for (let x = 0; x < w; x++) { let s = 0, n = 0;
    for (let y = -r; y < h + r; y++) {
      if (y + r < h && y + r >= 0) { s += tmp[(y + r) * w + x]; n++; }
      if (y - r - 1 >= 0) { s -= tmp[(y - r - 1) * w + x]; n--; }
      if (y >= 0 && y < h) out[y * w + x] = s / n;
    } }
  return out;
}

export type ScanMode = 'document' | 'bw' | 'photo';

// Pulizia del documento:
// 1) "colore della carta" punto per punto, per canale: chiusura (massimo poi minimo) che cancella la scrittura
//    ma segue ombre e luce, poi sfocatura; calcolata su una copia ridotta e interpolata;
// 2) ogni canale diviso per la sua carta: spariscono ombre e dominante della luce (carta neutra);
// 3) curva: la carta va a bianco pieno, l'inchiostro sbiadito si scurisce (scontrini termici);
// 4) leggera nitidezza. "bw" lavora sulla sola luminosità; "photo" lascia la foto com'è (solo ritaglio).
export function enhance(img: Img, mode: ScanMode = 'document'): Img {
  if (mode === 'photo') return img;
  const { width: w, height: h, data } = img;
  const { img: small, scale } = shrink(img, 480);
  const sw = small.width, sh = small.height;
  const r = Math.max(3, Math.round(Math.max(sw, sh) / 55));
  const chans = mode === 'bw' ? 1 : 3;
  const bgs: Float32Array[] = [];
  for (let c = 0; c < chans; c++) {
    const ch = new Float32Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) ch[i] = mode === 'bw' ? lum(small.data, i * 4) : small.data[i * 4 + c];
    let bg = rankFilter(ch, sw, sh, r, true);
    bg = rankFilter(bg, sw, sh, r, false);
    bg = boxBlur(bg, sw, sh, Math.max(2, Math.round(r / 2)));
    // zone scure grandi (loghi, riquadri pieni): la "carta" non scende sotto il 45% di quella tipica,
    // così restano scure invece di diventare bianche
    const sorted = Float32Array.from(bg).sort();
    const floor = 0.45 * sorted[Math.floor(sorted.length * 0.5)];
    for (let i = 0; i < bg.length; i++) bg[i] = Math.max(bg[i], floor, 8);
    bgs.push(bg);
  }
  const bgAt = (bg: Float32Array, x: number, y: number) => {
    const fx = Math.min(sw - 1, Math.max(0, x * scale - 0.5)), fy = Math.min(sh - 1, Math.max(0, y * scale - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
    const ax = fx - x0, ay = fy - y0;
    return (bg[y0 * sw + x0] * (1 - ax) + bg[y0 * sw + x1] * ax) * (1 - ay) + (bg[y1 * sw + x0] * (1 - ax) + bg[y1 * sw + x1] * ax) * ay;
  };
  // rapporto con la carta, per canale (o luminosità)
  const ratio = new Float32Array(w * h * chans);
  const hist = new Uint32Array(1001);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    let l = 0;
    for (let c = 0; c < chans; c++) {
      const v = (chans === 1 ? lum(data, i) : data[i + c]) / bgAt(bgs[c], x, y);
      ratio[(y * w + x) * chans + c] = v;
      l += v / chans;
    }
    hist[Math.min(1000, Math.round(l * 1000))]++;
  }
  // nero = inchiostro più scuro (1° percentile), con limiti: niente salti se la foto non ha testo scuro
  // si guarda lo 0,3%: anche uno scontrino con poco testo ne ha abbastanza
  let acc = 0, black = 0;
  for (let v = 0; v <= 1000; v++) { acc += hist[v]; if (acc >= w * h * 0.003) { black = v / 1000; break; } }
  black = Math.min(0.62, Math.max(0.05, black));
  // inchiostro sbiadito (nero alto): curva più ripida, così il testo diventa nero e non grigio
  const white = 0.86, gamma = (mode === 'bw' ? 1.5 : 1.3) + (black > 0.35 ? 0.7 : 0);
  const curve = (v: number) => { const t = Math.min(1, Math.max(0, (v - black) / (white - black))); return 255 * Math.pow(t, gamma); };
  const out = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    for (let c = 0; c < 3; c++) out[p * 4 + c] = curve(ratio[p * chans + (chans === 1 ? 0 : c)]);
    out[p * 4 + 3] = 255;
  }
  // nitidezza: maschera di contrasto 3x3 (non sulla carta già bianca)
  const sharp = new Uint8ClampedArray(out);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) for (let c = 0; c < 3; c++) {
    const i = (y * w + x) * 4 + c;
    if (out[i] === 255) continue;
    const m = (out[i - 4] + out[i + 4] + out[i - w * 4] + out[i + w * 4] + out[i] * 4) / 8;
    sharp[i] = out[i] + 0.6 * (out[i] - m);
  }
  return { data: sharp, width: w, height: h };
}

export function rotate90(img: Img): Img {
  const { width: w, height: h, data } = img;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = (y * w + x) * 4, di = (x * h + (h - 1 - y)) * 4;
    out[di] = data[si]; out[di + 1] = data[si + 1]; out[di + 2] = data[si + 2]; out[di + 3] = 255;
  }
  return { data: out, width: h, height: w };
}
