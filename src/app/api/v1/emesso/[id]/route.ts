import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { createClient } from '@/lib/supabase/server';

// PDF di un documento emesso ANNULLATO: lo stesso file archiviato, con la dicitura di annullamento su ogni pagina.
// Il file originale non viene toccato (resta la prova di ciò che era stato emesso); la dicitura si aggiunge allo scarico,
// così una ricevuta annullata non può circolare come valida (revisione finale del 15/11).
export const dynamic = 'force-dynamic';

const latin = (s: string) => s.normalize('NFC').replace(/[^\x20-\x7e\xa0-\xff]/g, '?');

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'non autenticato' }, { status: 401 });
  // la lettura passa dalla sessione dell'utente: valgono i permessi di sempre
  const { data: d } = await supabase.from('issued_docs').select('number, status, cancel_reason, file:documents(original_path)').eq('id', id).maybeSingle();
  const path = (d?.file as { original_path?: string } | null)?.original_path;
  if (!d || !path) return NextResponse.json({ error: 'non trovato' }, { status: 404 });
  // stesso percorso di lettura della pagina: collegamento firmato di breve durata
  const { data: signed } = await supabase.storage.from('documents').createSignedUrl(path, 60);
  const file = signed?.signedUrl ? await fetch(signed.signedUrl) : null;
  if (!file?.ok) return NextResponse.json({ error: 'file non disponibile' }, { status: 404 });
  let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
  const cancelled = d.status === 'cancelled';
  if (cancelled) {
    const pdf = await PDFDocument.load(bytes);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold), reg = await pdf.embedFont(StandardFonts.Helvetica);
    const red = rgb(0.698, 0.231, 0.196);
    const mark = 'ANNULLATO · ANNULÉ', note = latin(`Documento annullato / Document annulé${d.cancel_reason ? ` - ${d.cancel_reason}` : ''}`).slice(0, 110);
    for (const pg of pdf.getPages()) {
      const { width, height } = pg.getSize();
      const a0 = Math.atan2(height, width) * 0.75, size = (0.8 * width) / Math.cos(a0) / bold.widthOfTextAtSize(mark, 1);   // la scritta occupa l'80 % della larghezza
      const w = bold.widthOfTextAtSize(mark, size), a = Math.atan2(height, width) * 0.75;
      pg.drawText(mark, { x: width / 2 - (w / 2) * Math.cos(a), y: height / 2 - (w / 2) * Math.sin(a), size, font: bold, color: red, opacity: 0.28, rotate: degrees((a * 180) / Math.PI) });
      pg.drawRectangle({ x: 0, y: height - 22, width, height: 22, color: red, opacity: 0.92 });
      pg.drawText(note, { x: 14, y: height - 15, size: 9, font: reg, color: rgb(1, 1, 1) });
    }
    bytes = await pdf.save();
  }
  const name = `${d.number ?? 'documento'}${cancelled ? '_ANNULLATO' : ''}.pdf`;
  return new NextResponse(Buffer.from(bytes), { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'private, no-store' } });
}
