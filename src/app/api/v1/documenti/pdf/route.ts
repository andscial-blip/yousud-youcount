import { NextResponse, type NextRequest } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@/lib/supabase/server';

// POST /api/v1/documenti/pdf { movement_id }  →  { made }
// Dopo la registrazione (25/11): per ogni foto del movimento senza PDF, il server crea il PDF dalla scansione
// (una pagina larga come un A4) e lo collega al documento. Così il telefono invia solo la foto compressa e il
// giustificativo si scarica comunque in PDF con il nome del movimento. Tutto con i permessi dell'utente (RLS).
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Doc = { id: string; original_path: string; enhanced_path: string | null; pdf_path: string | null; mime: string };

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const movementId = typeof body?.movement_id === 'string' ? body.movement_id : null;
  if (!movementId) return NextResponse.json({ error: 'movement_id' }, { status: 400 });
  const { data: links } = await supabase.from('movement_documents')
    .select('document:documents(id, original_path, enhanced_path, pdf_path, mime)').eq('movement_id', movementId);
  const docs = ((links ?? []) as unknown as { document: Doc | null }[]).map((l) => l.document)
    .filter((d): d is Doc => Boolean(d) && !d!.pdf_path && (Boolean(d!.enhanced_path) || /^image\/(jpeg|png)$/.test(d!.mime)));
  const bucket = supabase.storage.from('documents');
  let made = 0;
  const skipped: string[] = [];
  for (const d of docs) {
    try {
      const src = d.enhanced_path ?? d.original_path;
      const { data: blob, error } = await bucket.download(src);
      if (error || !blob) { skipped.push(`download: ${error?.message ?? 'vuoto'}`); continue; }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const pdf = await PDFDocument.create();
      const png = bytes[0] === 0x89 && bytes[1] === 0x50;
      const img = png ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const pw = 595.28, ph = (pw * img.height) / img.width;   // larghezza A4, altezza in proporzione
      pdf.addPage([pw, ph]).drawImage(img, { x: 0, y: 0, width: pw, height: ph });
      pdf.setProducer('YouCount · YouSud ODV');
      const path = d.original_path.replace(/\.[^./]+$/, '') + '.pdf';
      const up = await bucket.upload(path, new Blob([await pdf.save() as BlobPart], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: false });
      if (up.error && !/exists|Duplicate/i.test(up.error.message)) { skipped.push(`upload: ${up.error.message}`); continue; }
      const { error: e2 } = await supabase.rpc('document_attach_pdf', { p_id: d.id, p_path: path });
      if (!e2) made++; else skipped.push(`rpc: ${e2.message}`);
    } catch (e) { skipped.push(String(e)); }
  }
  if (skipped.length) console.warn('[pdf]', movementId, skipped.join(' · '));
  return NextResponse.json({ made, candidates: docs.length, skipped });
}
