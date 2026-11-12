// Fotografie per il lavoro grafico (con l'anteprima avviata da: SERVE=1 LANGS=it npm run test:layout).
// Uso: node tests/e2e/shot.mjs /percorso[,/altro] [larghezze=1280] [prefisso]
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? '/opt/node-tools/node_modules/playwright');
const { base, S } = JSON.parse(fs.readFileSync('/tmp/yc-preview.json', 'utf8'));
const paths = (process.argv[2] ?? '/').split(',').map((p) => p.replace(/\{(\w+)\}/g, (_, k) => S[k]));
const widths = (process.argv[3] ?? '1280').split(',').map(Number);
const pre = process.argv[4] ?? 'p';
fs.mkdirSync('/tmp/yc-shots', { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: '/tmp/yc-state.json', deviceScaleFactor: 1, colorScheme: process.env.DARK ? 'dark' : 'light' });
await ctx.addInitScript(() => { try { sessionStorage.setItem('yc-splash', '1'); } catch {} });
for (const p of paths) for (const w of widths) {
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, Number(process.env.ERRLEN ?? 200))); });
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message.slice(0, 200)));
  await page.setViewportSize({ width: w, height: Number(process.env.H ?? 900) });
  await page.goto(base + p, { waitUntil: 'networkidle', timeout: 90000 });
  if (process.env.WAITFOR) await page.waitForSelector(process.env.WAITFOR, { timeout: 60000 });   // pagine lente in sviluppo: aspetta il contenuto, non lo scheletro
  await page.waitForFunction(() => !document.querySelector('#app [aria-busy="true"]'), null, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(300);
  const f = `/tmp/yc-shots/${pre}_${w}_${p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}.png`;
  await page.screenshot({ path: f, fullPage: !process.env.FOLD });
  console.log(f, errs.length ? 'ERR ' + errs.join(' | ') : '');
  await page.close();
}
await browser.close();
