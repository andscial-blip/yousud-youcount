import { z } from 'zod';

// Schema, istruzioni e controlli della lettura IA (codice puro, testabile). La chiamata all'API è in extract.ts.
// Regola: il modello riporta solo ciò che vede; ogni campo ha valore, fonte (testo letto), confidenza e stato.
// Nulla viene registrato senza la verifica umana campo per campo.

export const FIELD_NAMES = ['doc_type', 'doc_date', 'doc_number', 'supplier_name', 'supplier_tax_id', 'total', 'currency',
  'tax_amount', 'description', 'category_code', 'payment_method', 'language'] as const;
export type FieldName = (typeof FIELD_NAMES)[number];

const Field = z.object({
  value: z.union([z.string(), z.number(), z.null()]),
  source: z.string().max(300).nullable(),
  confidence: z.number().min(0).max(1),
  status: z.enum(['present', 'inferred', 'missing', 'ambiguous']),
  note: z.string().max(300).nullable().optional(),
});
export type ExtractedField = z.infer<typeof Field>;
export const Extraction = z.object(Object.fromEntries(FIELD_NAMES.map((f) => [f, Field])) as Record<FieldName, typeof Field>);
export type Extraction = z.infer<typeof Extraction>;
export type Check = { code: string; ok: boolean; message: string };

const fieldSchema = {
  type: 'object',
  properties: {
    value: { type: ['string', 'number', 'null'] },
    source: { type: ['string', 'null'], description: 'testo esatto letto sul documento da cui viene il valore (max 120 caratteri), null se assente' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    status: { type: 'string', enum: ['present', 'inferred', 'missing', 'ambiguous'] },
    note: { type: ['string', 'null'] },
  },
  required: ['value', 'source', 'confidence', 'status'],
};

export const TOOL = {
  name: 'record_receipt_fields',
  description: 'Registra i campi letti dal giustificativo.',
  input_schema: {
    type: 'object',
    properties: Object.fromEntries(FIELD_NAMES.map((f) => [f, fieldSchema])),
    required: [...FIELD_NAMES],
  },
};

export function buildPrompt(categories: { code: string; name: string }[], lang: 'it' | 'fr') {
  return `Sei l'assistente contabile di un'associazione che lavora in Italia e in Madagascar. Leggi il giustificativo allegato
(fattura, ricevuta, scontrino, autocertificazione) e compila i campi con lo strumento record_receipt_fields.

Regole obbligatorie:
- Riporta SOLO ciò che è scritto sul documento. Non inventare mai valori. Se un dato non c'è: value null, status "missing".
- status "present": il valore è scritto chiaramente; "ambiguous": leggibile solo in parte o con più valori possibili
  (spiega in note); "inferred": dedotto ma non scritto (ammesso solo per currency, language, category_code e doc_type).
- source: copia il testo esatto da cui hai preso il valore (es. "TOTAL 125 000 Ar"), null se missing o inferred.
- confidence: 0-1, quanto sei sicuro del valore letto.
- doc_date nel formato AAAA-MM-GG. Date malgasce e francesi sono nel formato GG/MM/AAAA.
- total e tax_amount come numero senza separatori delle migliaia (1 010 000 Ar → 1010000; 1.234,50 € → 1234.5).
- currency: "EUR" o "MGA" (Ar, Ariary, MGA sono MGA); un'altra valuta va scritta col codice ISO.
- doc_type: "invoice" (fattura/facture), "receipt" (ricevuta/reçu), "till_receipt" (scontrino/ticket de caisse),
  "self_cert" (autocertificazione/attestation), "other".
- supplier_tax_id: P.IVA, codice fiscale, NIF o STAT del fornitore se scritti.
- description: in ${lang === 'fr' ? 'francese' : 'italiano'}, massimo 80 caratteri, cosa è stato acquistato o ricevuto.
- payment_method: "cash", "card", "transfer", "mobile_money", "cheque" oppure null se non indicato.
- category_code: il codice più adatto da questo elenco, sempre con status "inferred" e motivazione in note; null se nessuno è adatto.
${categories.map((c) => `  ${c.code} ${c.name}`).join('\n')}
- language: lingua del documento ("it", "fr", "mg", "en").
- Se il documento è illeggibile o non è un giustificativo, metti tutti i campi missing e spiegalo in note di doc_type.`;
}

// Controlli automatici sui valori letti: non bloccano, segnalano a chi verifica.
export function runChecks(x: Extraction, now = new Date()): Check[] {
  const out: Check[] = [];
  const num = (f: ExtractedField) => (typeof f.value === 'number' ? f.value : f.value ? Number(String(f.value).replace(',', '.')) : NaN);
  const total = num(x.total);
  out.push({ code: 'total_present', ok: Number.isFinite(total) && total > 0, message: 'Totale leggibile e positivo' });
  if (x.doc_date.value) {
    const d = new Date(String(x.doc_date.value));
    const valid = !Number.isNaN(d.getTime());
    out.push({ code: 'date_valid', ok: valid && d <= now, message: 'Data valida e non futura' });
    if (valid) out.push({ code: 'date_recent', ok: now.getTime() - d.getTime() < 400 * 86400000, message: 'Documento degli ultimi 13 mesi' });
  } else out.push({ code: 'date_valid', ok: false, message: 'Data del documento assente' });
  const tax = num(x.tax_amount);
  if (Number.isFinite(tax) && Number.isFinite(total)) out.push({ code: 'tax_lt_total', ok: tax < total, message: 'Imposta inferiore al totale' });
  out.push({ code: 'currency_known', ok: x.currency.value === 'EUR' || x.currency.value === 'MGA', message: 'Valuta EUR o MGA' });
  const low = FIELD_NAMES.filter((f) => x[f].status === 'ambiguous' || (x[f].status === 'present' && x[f].confidence < 0.6));
  out.push({ code: 'confidence', ok: low.length === 0, message: low.length ? `Da controllare con attenzione: ${low.join(', ')}` : 'Lettura sicura' });
  return out;
}

export function parseToolInput(input: unknown): Extraction {
  return Extraction.parse(input);
}

// Risposta simulata per i test (AI_MOCK=1): nessuna chiamata esterna.
export function mockExtraction(): Extraction {
  const f = (value: string | number | null, source: string | null, status: ExtractedField['status'], confidence = 0.95, note: string | null = null) =>
    ({ value, source, status, confidence, note });
  return {
    doc_type: f('till_receipt', 'TICKET DE CAISSE', 'present'),
    doc_date: f(new Date().toISOString().slice(0, 10), new Date().toLocaleDateString('fr-FR'), 'present'),
    doc_number: f('TK-0042', 'N° TK-0042', 'present', 0.9),
    supplier_name: f('Librairie Mixte Analakely', 'LIBRAIRIE MIXTE ANALAKELY', 'present'),
    supplier_tax_id: f(null, null, 'missing', 0),
    total: f(125000, 'TOTAL 125 000 Ar', 'present', 0.97),
    currency: f('MGA', 'Ar', 'present', 0.99),
    tax_amount: f(null, null, 'missing', 0),
    description: f('Quaderni e penne per la scuola', 'CAHIER 100P x20 / STYLO x40', 'present', 0.8),
    category_code: f('303', null, 'inferred', 0.7, 'Materiale didattico per i beneficiari'),
    payment_method: f('cash', 'ESPECES', 'present', 0.9),
    language: f('fr', null, 'inferred', 0.9),
  };
}

