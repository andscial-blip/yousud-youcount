import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { date, money } from './format';

// PDF dell'autocertificazione di spesa (AUT). Testo ripreso dal Gestionale YouSud (art. 76 DPR 445/2000):
// lo verifica il commercialista. I dati vengono dal record self_certs, copiati dal movimento dal database.
export type SelfCert = {
  number: string; lang: 'it' | 'fr' | 'both'; declarant: string; declarant_role: string | null; place: string | null;
  reason: string; exp_date: string; amount: string | number; currency: string; amount_eur: string | number | null;
  supplier: string | null; description: string | null; category_code: string | null; project_name: string | null;
  method: string | null; method_fr?: string | null; category_fr?: string | null; signer_name: string | null; signer_role: string | null;
};
export type Org = { name: string; address?: string | null; tax_id?: string | null };

const BLANK = '________';
const v = (s: string | null | undefined) => (s && s.trim() ? s.trim() : BLANK);
// «pagata con contanti»: iniziale minuscola, salvo sigle (es. «MVola», «CB»)
const low = (s: string | null) => (s && !/^.[A-Z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

export function selfCertText(s: SelfCert, org: Org) {
  const amt = (l: 'it' | 'fr') => money(s.amount, s.currency, l)
    + (s.currency !== 'EUR' && s.amount_eur ? (l === 'it' ? ` (pari a circa ${money(s.amount_eur, 'EUR', l)})` : ` (soit environ ${money(s.amount_eur, 'EUR', l)})`) : '');
  const role = s.declarant_role ? `, ${s.declarant_role},` : ',';
  const it = [
    `Il/La sottoscritto/a ${v(s.declarant)}${role} in nome e per conto di ${org.name}, consapevole delle responsabilità e delle sanzioni penali previste dall'art. 76 del DPR 445/2000 in caso di dichiarazioni mendaci, DICHIARA sotto la propria responsabilità di aver sostenuto in data ${date(s.exp_date)} presso ${v(s.supplier)}${s.place ? ` (${s.place})` : ''} la spesa di ${amt('it')} per: ${v(s.description)}${s.category_code ? ` (codice ${s.category_code})` : ''}${s.project_name ? `, relativa al progetto «${s.project_name}»` : ''}, pagata con ${v(low(s.method))}.`,
    `Motivo dell'assenza del giustificativo fiscale: ${v(s.reason)}. Si impegna a conservare ogni elemento utile a verificare la spesa.`,
  ];
  const fr = [
    `Je soussigné(e) ${v(s.declarant)}${role} agissant au nom et pour le compte de ${org.name}, conscient(e) des sanctions prévues en cas de fausse déclaration, ATTESTE SUR L'HONNEUR avoir engagé le ${date(s.exp_date)} auprès de ${v(s.supplier)}${s.place ? ` (${s.place})` : ''} la dépense de ${amt('fr')} pour : ${v(s.description)}${s.category_fr ?? s.category_code ? ` (code ${s.category_fr ?? s.category_code})` : ''}${s.project_name ? `, relative au projet « ${s.project_name} »` : ''}, payée par ${v(low(s.method_fr ?? s.method))}.`,
    `Motif d'absence de justificatif fiscal : ${v(s.reason)}. Le/la déclarant(e) s'engage à conserver tout élément permettant de vérifier la dépense.`,
  ];
  return { it, fr };
}

// I caratteri fuori dalla codifica dei font standard del PDF (WinAnsi) si sostituiscono o si tolgono.
function clean(font: PDFFont, s: string) {
  const t = s.replace(/[   ]/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  let out = '';
  for (const ch of t) {
    try { font.encodeText(ch); out += ch; } catch { out += '?'; }
  }
  return out;
}

function wrap(font: PDFFont, size: number, text: string, width: number) {
  const lines: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function selfCertPdf(s: SelfCert, org: Org): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${s.number} – ${org.name}`);
  pdf.setAuthor(org.name);
  pdf.setCreator('YouCount');
  const page = pdf.addPage([595.28, 841.89]);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.13, 0.15, 0.18), soft = rgb(0.38, 0.41, 0.45), rule = rgb(0.8, 0.82, 0.85);
  const M = 56, W = 595.28 - 2 * M;
  let y = 841.89 - M;
  const put = (text: string, o: { size?: number; font?: PDFFont; color?: typeof ink; gap?: number; x?: number; w?: number } = {}) => {
    const size = o.size ?? 10.5, font = o.font ?? reg, w = o.w ?? W;
    for (const l of wrap(font, size, clean(font, text), w)) {
      page.drawText(l, { x: o.x ?? M, y: y - size, size, font, color: o.color ?? ink });
      y -= size * 1.45;
    }
    y -= o.gap ?? 0;
  };
  const hr = () => { page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.6, color: rule }); y -= 14; };

  put(org.name, { size: 14, font: bold });
  const sub = [org.address, org.tax_id ? `C.F. ${org.tax_id}` : null].filter(Boolean).join(' · ');
  if (sub) put(sub, { size: 9, color: soft });
  y -= 6; hr();

  const both = s.lang === 'both';
  const title = s.lang === 'fr' ? 'ATTESTATION DE DÉPENSE SUR L\'HONNEUR' : both ? 'AUTOCERTIFICAZIONE DI SPESA / ATTESTATION DE DÉPENSE' : 'AUTOCERTIFICAZIONE DI SPESA';
  put(title, { size: 13, font: bold, gap: 2 });
  put(`${s.lang === 'fr' ? 'N°' : 'N.'} ${s.number}`, { size: 10, color: soft, gap: 12 });

  const txt = selfCertText(s, org);
  const main = s.lang === 'fr' ? txt.fr : txt.it;
  for (const p of main) put(p, { gap: 8 });
  if (both) {
    y -= 4;
    for (const p of txt.fr) put(p, { size: 9.5, color: soft, gap: 6 });
  }

  y -= 18;
  put(s.lang === 'fr' ? 'Lieu et date : ______________________' : both ? 'Luogo e data / Lieu et date: ______________________' : 'Luogo e data: ______________________', { gap: 34 });

  // due firme affiancate
  const colW = (W - 30) / 2;
  const sigY = y;
  const lab1 = (s.lang === 'fr' ? 'Le/la déclarant(e)' : both ? 'Il dichiarante / Le déclarant' : 'Il dichiarante') + ` – ${s.declarant}`;
  const lab2 = (s.lang === 'fr' ? 'Visa pour approbation' : both ? 'Visto per approvazione / Visa' : 'Visto per approvazione')
    + (s.signer_name ? ` – ${[s.signer_name, s.signer_role].filter(Boolean).join(', ')}` : '');
  [lab1, lab2].forEach((lab, i) => {
    const x = M + i * (colW + 30);
    page.drawLine({ start: { x, y: sigY }, end: { x: x + colW, y: sigY }, thickness: 0.6, color: ink });
    y = sigY - 4;
    put(lab, { size: 9, color: soft, x, w: colW });
  });

  page.drawText(clean(reg, `${s.number} · ${org.name} · YouCount`), { x: M, y: 30, size: 7.5, font: reg, color: soft });
  return pdf.save();
}
