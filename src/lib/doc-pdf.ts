import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Cell, Model } from './doc-model';

// PDF A4 di un documento emesso, dal modello comune (vedi doc-model). Font standard del PDF (Helvetica):
// i caratteri fuori codifica WinAnsi si sostituiscono, gli spazi speciali dei formati numerici diventano spazi.
function clean(font: PDFFont, s: string) {
  const t = s.replace(/[\u202f\u2007\u2009]/g, '\u00a0').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/−/g, '-');
  let out = '';
  for (const ch of t) { try { font.encodeText(ch); out += ch; } catch { out += '?'; } }
  return out;
}
function wrap(font: PDFFont, size: number, text: string, width: number) {
  const lines: string[] = [];
  let line = '';
  for (const w of text.split(/[ \t\n]+/)) {   // gli spazi non separabili (NBSP) tengono uniti numero e unità
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderPdf(md: Model): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${md.number ?? 'BOZZA'} – ${md.title}`);
  pdf.setAuthor(md.org.name); pdf.setCreator('YouCount');
  const reg = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.094, 0.133, 0.184), soft = rgb(0.333, 0.384, 0.459), rule = rgb(0.84, 0.87, 0.9), band = rgb(0.949, 0.961, 0.976);
  const W0 = 595.28, H0 = 841.89, M = 56, W = W0 - 2 * M;
  let page: PDFPage = pdf.addPage([W0, H0]);
  let y = H0 - M;
  const need = (h: number) => { if (y - h < 70) { page = pdf.addPage([W0, H0]); y = H0 - M; } };
  const put = (text: string, o: { size?: number; font?: PDFFont; color?: typeof ink; gap?: number; x?: number; w?: number } = {}) => {
    const size = o.size ?? 10.5, font = o.font ?? reg, w = o.w ?? W;
    for (const l of wrap(font, size, clean(font, text), w)) {
      need(size * 1.5);
      page.drawText(l, { x: o.x ?? M, y: y - size, size, font, color: o.color ?? ink });
      y -= size * 1.45;
    }
    y -= o.gap ?? 0;
  };
  const hr = () => { page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.6, color: rule }); y -= 14; };

  // logo dell'ente in alto a destra (al massimo 130 × 48 pt), testo dell'intestazione a sinistra
  let logoW = 0;
  if (md.org.logo) {
    try {
      const bytes = Uint8Array.from(atob(md.org.logo.data), (c) => c.charCodeAt(0));
      const img = md.org.logo.mime === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const k = Math.min(130 / img.width, 48 / img.height, 1);
      const w = img.width * k, h = img.height * k;
      page.drawImage(img, { x: M + W - w, y: y - h + 2, width: w, height: h });
      logoW = w + 16;
      const top = y;
      put(md.org.name, { size: 14, font: bold, w: W - logoW });
      if (md.orgLine) put(md.orgLine, { size: 9, color: soft, w: W - logoW });
      y = Math.min(y, top - h);
    } catch { logoW = 0; }
  }
  if (!logoW) {
    put(md.org.name, { size: 14, font: bold });
    if (md.orgLine) put(md.orgLine, { size: 9, color: soft });
  }
  y -= 6; hr();
  put(md.title.toUpperCase(), { size: 13, font: bold, gap: 4 });
  put(md.meta.map(([k, v]) => `${k} ${v}`).join('   ·   '), { size: 9.5, color: soft, gap: 12 });
  if (!md.number) put(md.draftLabel, { size: 10, font: bold, color: rgb(0.7, 0.23, 0.2), gap: 6 });

  for (const b of md.blocks) {
    if (b.k === 'p') put(b.text, { size: b.soft ? 9.5 : 10.5, color: b.soft ? soft : ink, font: b.strong ? bold : reg, gap: 8 });
    else if (b.k === 'table') {
      const cw = [W * 0.52, W * 0.12, W * 0.18, W * 0.18].slice(0, b.head.length);
      if (b.head.length === 4 && b.num.length === 1) cw.splice(0, 4, W * 0.14, W * 0.48, W * 0.18, W * 0.2);
      const row = (cells: Cell[], f: PDFFont, fill?: boolean) => {
        const main = (c: Cell) => (typeof c === 'string' ? c : c[0]);
        const hs = cells.map((c, i) => wrap(f, 9.5, clean(f, main(c)), cw[i] - 8).length + (typeof c === 'string' ? 0 : 0.85));
        const h = Math.max(...hs) * 13 + 8;
        need(h);
        if (fill) page.drawRectangle({ x: M, y: y - h, width: W, height: h, color: band });
        let x = M;
        cells.forEach((c, i) => {
          const ls = wrap(f, 9.5, clean(f, main(c)), cw[i] - 8);
          const right = b.num.includes(i);
          ls.forEach((l, j) => {
            const tw = f.widthOfTextAtSize(l, 9.5);
            page.drawText(l, { x: right ? x + cw[i] - 4 - tw : x + 4, y: y - 13 - j * 13, size: 9.5, font: f, color: ink });
          });
          if (typeof c !== 'string' && c[1]) {   // MGA in piccolo sotto l'importo in €
            const sv = clean(reg, c[1]), sw = reg.widthOfTextAtSize(sv, 7.5);
            page.drawText(sv, { x: right ? x + cw[i] - 4 - sw : x + 4, y: y - 13 - ls.length * 13 + 2, size: 7.5, font: reg, color: soft });
          }
          x += cw[i];
        });
        y -= h;
        page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: rule });
      };
      row(b.head, bold, true);
      b.rows.forEach((r) => row(r, reg));
      y -= 10;
    } else if (b.k === 'totals') {
      for (const [k, v, strong] of b.rows) {
        const sub = typeof v === 'string' ? '' : v[1];
        need(sub ? 27 : 16);
        const f = strong ? bold : reg, kv = clean(f, k), vv = clean(f, typeof v === 'string' ? v : v[0]);
        const size = strong ? 12 : 10.5;
        page.drawText(kv, { x: M + W * 0.45, y: y - 11, size: 10.5, font: f, color: ink });
        page.drawText(vv, { x: M + W - f.widthOfTextAtSize(vv, size), y: y - 11, size, font: f, color: ink });
        y -= 16;
        if (sub) { const sv = clean(reg, sub); page.drawText(sv, { x: M + W - reg.widthOfTextAtSize(sv, 8), y: y - 7, size: 8, font: reg, color: soft }); y -= 11; }
      }
      y -= 8;
    } else {
      y -= 18;
      put(`${md.placeDate}: ______________________`, { size: 9.5, color: soft, gap: 30 });
      need(40);
      const colW = (W - 30) / 2, sigY = y;
      b.labels.forEach((lab, i) => {
        const x = M + i * (colW + 30);
        page.drawLine({ start: { x, y: sigY }, end: { x: x + colW, y: sigY }, thickness: 0.6, color: ink });
        y = sigY - 4;
        put(lab, { size: 9, color: soft, x, w: colW });
      });
    }
  }
  if (md.fxNote) { y -= 6; put(md.fxNote, { size: 8.5, color: soft }); }
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    if (md.footer) for (const [j, l] of wrap(reg, 7.5, clean(reg, md.footer), W).entries()) p.drawText(l, { x: M, y: 42 - j * 10, size: 7.5, font: reg, color: soft });
    p.drawText(clean(reg, `${md.number ?? 'BOZZA'} · ${md.org.name} · YouCount${pages.length > 1 ? ` · ${i + 1}/${pages.length}` : ''}`),
      { x: M, y: 22, size: 7.5, font: reg, color: soft });
  });
  return pdf.save();
}
