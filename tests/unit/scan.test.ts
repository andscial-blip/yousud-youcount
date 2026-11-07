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

test('bordi: foto tutta uniforme → margine fisso', () => {
  const found = detectCorners(canvas(400, 600, () => 200));
  assert.ok(Math.abs(found[0].x - 16) < 1 && Math.abs(found[2].y - 576) < 1);
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
