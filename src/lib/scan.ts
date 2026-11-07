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

// Angoli del foglio: il foglio è di solito più chiaro dello sfondo. Soglia di Otsu, regione chiara più grande,
// poi i quattro punti estremi (alto-sinistra, alto-destra, basso-destra, basso-sinistra). Se non convince: margine fisso.
export function detectCorners(full: Img): Pt[] {
  const { img, scale } = downscale(full, 320);
  const { width: w, height: h, data } = img;
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = lum(data, i * 4);
  const thr = otsu(L);
  const seen = new Uint8Array(w * h);
  let bestPix: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || L[start] <= thr) continue;
    const pix: number[] = [];
    stack.push(start); seen[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      pix.push(p);
      const x = p % w, y = (p - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (!seen[q] && L[q] > thr) { seen[q] = 1; stack.push(q); }
      }
    }
    if (pix.length > bestPix.length) bestPix = pix;
  }
  const frac = bestPix.length / (w * h);
  const inset = (): Pt[] => {
    const mx = full.width * 0.04, my = full.height * 0.04;
    return [{ x: mx, y: my }, { x: full.width - mx, y: my }, { x: full.width - mx, y: full.height - my }, { x: mx, y: full.height - my }];
  };
  if (frac < 0.15 || frac > 0.97) return inset();
  let tl = bestPix[0], tr = tl, br = tl, bl = tl;
  const xy = (p: number) => [p % w, Math.floor(p / w)];
  for (const p of bestPix) {
    const [x, y] = xy(p);
    const [a, b] = xy(tl), [c, d] = xy(tr), [e, f] = xy(br), [g, k] = xy(bl);
    if (x + y < a + b) tl = p;
    if (x - y > c - d) tr = p;
    if (x + y > e + f) br = p;
    if (y - x > k - g) bl = p;
  }
  return [tl, tr, br, bl].map((p) => { const [x, y] = xy(p); return { x: (x + 0.5) / scale, y: (y + 0.5) / scale }; });
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

// Toglie le ombre (divide per lo sfondo stimato con una sfocatura ampia) e allunga il contrasto.
export function enhance(img: Img): Img {
  const { width: w, height: h, data } = img;
  const cell = Math.max(8, Math.round(Math.max(w, h) / 40));
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  // sfondo = luminosità alta (90° percentile approssimato con il massimo smorzato) per cella
  const bg = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const vals: number[] = [];
    for (let y = gy * cell; y < Math.min(h, (gy + 1) * cell); y += 2) for (let x = gx * cell; x < Math.min(w, (gx + 1) * cell); x += 2) vals.push(lum(data, (y * w + x) * 4));
    vals.sort((a, b) => a - b);
    bg[gy * gw + gx] = Math.max(40, vals[Math.floor(vals.length * 0.9)] ?? 255);
  }
  // sfoca la griglia dello sfondo
  const blur = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    let s = 0, n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = gx + dx, y = gy + dy;
      if (x >= 0 && y >= 0 && x < gw && y < gh) { s += bg[y * gw + x]; n++; }
    }
    blur[gy * gw + gx] = s / n;
  }
  const out = new Uint8ClampedArray(w * h * 4);
  const bgAt = (x: number, y: number) => {
    const fx = Math.min(gw - 1, Math.max(0, x / cell - 0.5)), fy = Math.min(gh - 1, Math.max(0, y / cell - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1);
    const ax = fx - x0, ay = fy - y0;
    return (blur[y0 * gw + x0] * (1 - ax) + blur[y0 * gw + x1] * ax) * (1 - ay) + (blur[y1 * gw + x0] * (1 - ax) + blur[y1 * gw + x1] * ax) * ay;
  };
  const hist = new Array(256).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, k = 245 / bgAt(x, y);
    for (let c = 0; c < 3; c++) out[i + c] = data[i + c] * k;
    out[i + 3] = 255;
    hist[Math.round(lum(out, i))]++;
  }
  // contrasto: porta il 2° percentile a 0 e il 98° a 255
  const tot = w * h;
  let acc = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= tot * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= tot * 0.02) { hi = v; break; } }
  const span = Math.max(30, hi - lo);
  for (let i = 0; i < out.length; i += 4) for (let c = 0; c < 3; c++) out[i + c] = ((out[i + c] - lo) * 255) / span;
  return { data: out, width: w, height: h };
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
