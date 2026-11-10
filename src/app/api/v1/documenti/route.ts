import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { docName } from '@/lib/doc-name';

// Elenco dei giustificativi di un anno (o di un mese) con un link firmato valido 10 minuti per ciascuno:
// il telefono o il computer li scarica e li raccoglie in un file ZIP. I file passano dal browser
// dell'utente, con i suoi permessi (RLS): chi non vede un giustificativo non lo riceve.
type Row = { id: string; doc_date: string | null; created_at: string; original_path: string; pdf_path: string | null; file_name: string | null;
  links: { seq: number; movement: { ref: string | null; op_date: string; doc_date: string | null } | null }[] };

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const u = new URL(req.url);
  const year = Number(u.searchParams.get('anno'));
  const month = Number(u.searchParams.get('mese') || 0);
  if (!(year >= 2000 && year <= 2100) || !(month >= 0 && month <= 12)) return NextResponse.json({ error: 'periodo' }, { status: 400 });
  const { data, error } = await supabase.from('documents')
    .select('id, doc_date, created_at, original_path, pdf_path, file_name, links:movement_documents(seq, movement:movements(ref, op_date, doc_date))')
    .neq('doc_type', 'statement').order('created_at').limit(3000).returns<Row[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const prefix = month ? `${year}-${String(month).padStart(2, '0')}` : `${year}`;
  const pick = (data ?? []).map((d) => {
    const link = [...(d.links ?? [])].sort((a, b) => (a.movement?.ref ? 0 : 1) - (b.movement?.ref ? 0 : 1))[0];
    const m = link?.movement ?? null;
    const day = (d.doc_date ?? m?.doc_date ?? m?.op_date ?? d.created_at).slice(0, 10);
    const path = d.pdf_path ?? d.original_path;
    const base = docName(m?.ref, link?.seq, path, d.file_name).replace(/[\\/:*?"<>|]+/g, '-');
    return { day, path, name: `${day}_${m?.ref ? base : `senza-movimento_${base}`}` };
  }).filter((x) => x.day.startsWith(prefix));
  if (!pick.length) return NextResponse.json({ files: [] });
  const { data: signed, error: e2 } = await supabase.storage.from('documents').createSignedUrls(pick.map((p) => p.path), 600);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  // nomi unici dentro lo ZIP
  const seen = new Map<string, number>();
  const files = pick.map((p, i) => {
    let name = p.name; const n = seen.get(name) ?? 0; seen.set(name, n + 1);
    if (n) { const dot = name.lastIndexOf('.'); name = dot > 0 ? `${name.slice(0, dot)}_${n + 1}${name.slice(dot)}` : `${name}_${n + 1}`; }
    return { name, url: signed?.[i]?.signedUrl ?? null };
  }).filter((f) => f.url);
  return NextResponse.json({ files });
}
