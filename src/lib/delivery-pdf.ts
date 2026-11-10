import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

// Ricevuta di consegna di contanti firmata sul telefono o sul computer: testo della dichiarazione, le due firme
// (chi riceve, chi consegna) come immagini, data e ora della firma. Font standard del PDF (Helvetica, WinAnsi).
function clean(font: PDFFont, s: string) {
  const t = s.replace(/[   ]/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/−/g, '-');
  let out = '';
  for (const ch of t) { try { font.encodeText(ch); out += ch; } catch { out += '?'; } }
  return out;
}
function wrap(font: PDFFont, size: number, text: string, width: number) {
  const lines: string[] = [];
  let line = '';
  for (const w of text.split(/[ \t\n]+/)) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export type DeliveryPdf = {
  org: string; title: string; paragraphs: string[]; rows: [string, string][];
  receiver: { label: string; name: string; png: Uint8Array }; giver: { label: string; name: string; png: Uint8Array };
  footer: string;
};

export async function renderDeliveryPdf(d: DeliveryPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(d.title); pdf.setAuthor(d.org); pdf.setCreator('YouCount');
  const reg = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.094, 0.133, 0.184), soft = rgb(0.333, 0.384, 0.459), rule = rgb(0.84, 0.87, 0.9);
  const W0 = 595.28, H0 = 841.89, M = 56, W = W0 - 2 * M;
  const page = pdf.addPage([W0, H0]);
  let y = H0 - M;
  const put = (text: string, o: { size?: number; font?: PDFFont; color?: typeof ink; gap?: number; x?: number; w?: number } = {}) => {
    const size = o.size ?? 11, font = o.font ?? reg;
    for (const l of wrap(font, size, clean(font, text), o.w ?? W)) { page.drawText(l, { x: o.x ?? M, y: y - size, size, font, color: o.color ?? ink }); y -= size * 1.5; }
    y -= o.gap ?? 0;
  };
  put(d.org, { size: 10, color: soft, gap: 6 });
  put(d.title, { size: 18, font: bold, gap: 12 });
  for (const p of d.paragraphs) put(p, { gap: 8 });
  y -= 4;
  for (const [k, v] of d.rows) {
    page.drawText(clean(reg, k), { x: M, y: y - 10, size: 10, font: reg, color: soft });
    const ls = wrap(bold, 10.5, clean(bold, v), W - 170);
    ls.forEach((l, i) => page.drawText(l, { x: M + 170, y: y - 10 - i * 15, size: 10.5, font: bold, color: ink }));
    y -= Math.max(1, ls.length) * 15 + 4;
  }
  y -= 18;
  // due riquadri di firma affiancati
  const bw = (W - 24) / 2, bh = 110;
  for (const [i, s] of [d.receiver, d.giver].entries()) {
    const x = M + i * (bw + 24);
    page.drawText(clean(reg, s.label), { x, y: y - 10, size: 10, font: reg, color: soft });
    page.drawRectangle({ x, y: y - 18 - bh, width: bw, height: bh, borderColor: rule, borderWidth: 0.8 });
    const img = await pdf.embedPng(s.png);
    const sc = Math.min((bw - 16) / img.width, (bh - 16) / img.height);
    page.drawImage(img, { x: x + (bw - img.width * sc) / 2, y: y - 18 - bh + (bh - img.height * sc) / 2, width: img.width * sc, height: img.height * sc });
    page.drawText(clean(bold, s.name), { x, y: y - 18 - bh - 16, size: 10.5, font: bold, color: ink });
  }
  y -= 18 + bh + 40;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.6, color: rule });
  y -= 8;
  put(d.footer, { size: 8.5, color: soft });
  return pdf.save();
}
