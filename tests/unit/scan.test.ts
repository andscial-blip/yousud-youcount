import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyH, detectCorners, enhance, homography, rotate90, warp, type Img } from '../../src/lib/scan.ts';

function canvas(w: number, h: number, fill: (x: number, y: number) => number): Img {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fill(x, y), i = (y * w + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}
const inQuad = (q: { x: number; y: number }[], x: number, y: number) => {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const c = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    s += c > 0 ? 1 : -1;
  }
  return Math.abs(s) === 4;
};

test('omografia: gli angoli del rettangolo finiscono sugli angoli del foglio', () => {
  const quad = [{ x: 40, y: 30 }, { x: 260, y: 50 }, { x: 250, y: 380 }, { x: 30, y: 360 }];
  const H = homography(quad, 200, 300);
  const pts = [[0, 0], [200, 0], [200, 300], [0, 300]].map(([x, y]) => applyH(H, x, y));
  pts.forEach((p, i) => { assert.ok(Math.abs(p.x - quad[i].x) < 1e-6 && Math.abs(p.y - quad[i].y) < 1e-6); });
});

test('bordi: trova un foglio chiaro inclinato su sfondo scuro', () => {
  const quad = [{ x: 120, y: 80 }, { x: 520, y: 140 }, { x: 470, y: 700 }, { x: 70, y: 640 }];
  const img = canvas(600, 800, (x, y) => (inQuad(quad, x, y) ? 235 : 60));
  const found = detectCorners(img);
  found.forEach((p, i) => assert.ok(Math.hypot(p.x - quad[i].x, p.y - quad[i].y) < 16, `angolo ${i}: ${JSON.stringify(p)}`));
});

test('bordi: foto tutta uniforme → tutta la foto con margine del 2%', () => {
  const found = detectCorners(canvas(400, 600, () => 200));
  assert.ok(Math.abs(found[0].x - 8) < 1 && Math.abs(found[2].y - 588) < 1);
});

test('raddrizzamento e rotazione: dimensioni corrette', () => {
  const img = canvas(300, 400, (x) => x % 256);
  const out = warp(img, [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 400 }, { x: 0, y: 400 }]);
  assert.deepEqual([out.width, out.height], [300, 400]);
  assert.ok(Math.abs(out.data[(10 * 300 + 100) * 4] - 100) <= 1, 'mappatura identità');
  const r = rotate90(img);
  assert.deepEqual([r.width, r.height], [400, 300]);
});

test('ombre: un foglio con ombra a gradiente diventa uniforme e il testo resta scuro', () => {
  // foglio bianco con ombra da sinistra (luminosità 120 → 240) e una riga di "testo" scuro al centro
  const img = canvas(400, 300, (x, y) => (y > 145 && y < 155 && x > 50 && x < 350 ? 30 + x * 0.1 : 120 + x * 0.3));
  const out = enhance(img);
  const at = (x: number, y: number) => out.data[(y * 400 + x) * 4];
  assert.ok(Math.abs(at(20, 50) - at(380, 50)) < 30, `sfondo uniforme: ${at(20, 50)} vs ${at(380, 50)}`);
  assert.ok(at(200, 150) < 90, `testo scuro: ${at(200, 150)}`);
});

function rgb(w: number, h: number, fill: (x: number, y: number) => [number, number, number]): Img {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = fill(x, y), i = (y * w + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}

test('documento: la luce calda sparisce (carta neutra) e la penna blu resta blu', () => {
  // carta gialla per la luce calda, una riga di penna blu
  const img = rgb(400, 300, (x, y) => (y > 140 && y < 150 && x > 60 && x < 340 ? [40, 50, 150] : [235, 215, 170]));
  const out = enhance(img, 'document');
  const px = (x: number, y: number) => Array.from(out.data.slice((y * 400 + x) * 4, (y * 400 + x) * 4 + 3));
  const [r, g, b] = px(30, 40);
  assert.ok(r > 245 && g > 245 && b > 245, `carta bianca e neutra: ${[r, g, b]}`);
  const [ir, , ib] = px(200, 145);
  assert.ok(ib > ir + 40 && ir < 120, `inchiostro blu: ${px(200, 145)}`);
});

test('documento: l\'ombra netta sparisce senza aloni', () => {
  // metà destra del foglio in ombra netta (luminosità dimezzata)
  const img = canvas(400, 300, (x) => (x < 200 ? 230 : 115));
  const out = enhance(img, 'document');
  for (const x of [20, 190, 210, 380]) assert.ok(out.data[(150 * 400 + x) * 4] > 240, `x=${x}: ${out.data[(150 * 400 + x) * 4]}`);
});

test('scontrino termico: il testo sbiadito diventa scuro', () => {
  const img = canvas(300, 600, (x, y) => (y % 40 > 30 && x > 40 && x < 260 ? 150 : 225));
  const out = enhance(img, 'document');
  assert.ok(out.data[(35 * 300 + 150) * 4] < 70, `testo: ${out.data[(35 * 300 + 150) * 4]}`);
  assert.ok(out.data[(10 * 300 + 150) * 4] > 245, 'carta bianca');
});

test('bianco e nero: grigi puri; foto: immagine invariata', () => {
  const img = rgb(200, 200, (x) => [200 + (x % 20), 180, 150]);
  const bw = enhance(img, 'bw');
  for (let i = 0; i < bw.data.length; i += 4 * 97) assert.ok(bw.data[i] === bw.data[i + 1] && bw.data[i + 1] === bw.data[i + 2]);
  assert.equal(enhance(img, 'photo'), img);
});

test('bordi: se un lato cade su una sfumatura d\'ombra il ritaglio non è inventato', () => {
  // foglio chiaro su tavolo chiaro con forte sfumatura in basso a destra: niente bordi netti su due lati
  const img = canvas(600, 800, (x, y) => {
    const shade = 1 - 0.6 * Math.max(0, Math.min(1, (x * 0.6 + y * 0.4 - 380) / 200));
    const paper = x > 60 && x < 560 && y > 50 && y < 770;
    return (paper ? 245 : 215) * shade;
  });
  const q = detectCorners(img);
  const plausible = Math.hypot(q[2].x - 560, q[2].y - 770) < 25;
  const full = Math.abs(q[2].x - 588) < 1 && Math.abs(q[2].y - 784) < 1;
  assert.ok(plausible || full, `angolo basso-destra: ${JSON.stringify(q[2])}`);
});
