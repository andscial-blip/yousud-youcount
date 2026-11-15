// Archivio su Google Drive: dove va ogni file e come si chiama. Solo funzioni pure (provate nei test unitari).
// Albero deciso con il parere di un contabile ETS e di un archivista (15/11/2026):
//   AAAA/01_Giustificativi/AAAA-MM          anno e mese della data del movimento (contabilità per cassa)
//   AAAA/02_Documenti-emessi/<TIPO_Nome>    anno della serie di numerazione
//   AAAA/05_Riservato/NOT_Notule            notule: contengono dati fiscali della persona

export type DriveTarget = {
  document_id: string; kind: 'issued' | 'receipt'; code: string; ref: string; on_date: string; seq: number;
  party: string | null; total: number | string | null; currency: string | null; cancelled: boolean;
  path: string; mime: string; file_name: string | null;
};

export const ROOT_NAME = 'YouSud - Archivio contabile';

const ISSUED_FOLDERS: Record<string, string> = {
  RIC: 'RIC_Ricevute', QUI: 'QUI_Quietanze', NRS: 'NRS_Rimborsi-spese', ASP: 'ASP_Autorizzazioni-spesa',
  NDD: 'NDD_Note-debito', DIC: 'DIC_Dichiarazioni', BDC: 'BDC_Buoni-ordine',
};

/** Solo lettere e cifre senza accenti, parole unite da «-»: nomi leggibili e ordinabili su ogni sistema. */
export function slug(s: string | null | undefined, max = 30): string {
  const t = (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return t.length > max ? t.slice(0, max).replace(/-+$/, '') : t;
}

const ext = (t: DriveTarget) => {
  if (t.mime === 'application/pdf') return 'pdf';
  const fromPath = /\.([A-Za-z0-9]{2,5})$/.exec(t.path)?.[1]?.toLowerCase();
  if (fromPath) return fromPath;
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' } as Record<string, string>)[t.mime] ?? 'bin';
};

/** Importo senza separatori nella valuta del documento: 185000MGA, 150EUR, 12.50EUR. */
export function amountTag(total: DriveTarget['total'], currency: string | null): string {
  if (total === null || total === undefined || total === '') return '';
  const n = Number(total);
  if (!Number.isFinite(n)) return '';
  const v = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return `${v}${(currency ?? '').trim().toUpperCase()}`;
}

/** Anno contabile del file: per gli emessi quello della serie (RIC-2026-014), altrimenti quello della data. */
export function yearOf(t: DriveTarget): string {
  if (t.kind === 'issued') { const m = /-(\d{4})-\d+$/.exec(t.ref); if (m) return m[1]; }
  return t.on_date.slice(0, 4);
}

/** Percorso della cartella, dalla radice dell'archivio. */
export function folderPath(t: DriveTarget): string[] {
  const y = yearOf(t);
  if (t.kind === 'issued') {
    if (t.code === 'NOT') return [y, '05_Riservato', 'NOT_Notule'];
    return [y, '02_Documenti-emessi', ISSUED_FOLDERS[t.code] ?? `${slug(t.code, 8)}_Altri`];
  }
  if (t.code === 'AUT') return [y, '02_Documenti-emessi', 'AUT_Autocertificazioni'];
  return [y, '01_Giustificativi', t.on_date.slice(0, 7)];
}

/** Nome del file: univoco (numero del documento, o movimento + progressivo dell'allegato), ordinabile per data. */
export function fileName(t: DriveTarget): string {
  const tail = [slug(t.party), amountTag(t.total, t.currency)].filter(Boolean).join('_');
  const base = t.kind === 'issued'
    ? [t.ref, t.on_date, tail].filter(Boolean).join('_') + (t.cancelled ? '_ANNULLATO' : '')
    : [t.on_date, t.ref, `a${String(t.seq).padStart(2, '0')}`, t.code, tail].filter(Boolean).join('_');
  return `${base}.${ext(t)}`;
}
