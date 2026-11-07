// Nome di un giustificativo collegato a un movimento registrato: MOV-2026-003.pdf, MOV-2026-003_2.jpg, ...
// Il file nell'archivio non cambia nome (è immutabile): questo è il nome mostrato e usato per il download.
// Per le bozze (ancora senza numero) resta il nome originale del file.

export function fileExt(path: string): string {
  const base = path.split('/').pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

export function docName(ref: string | null | undefined, seq: number | null | undefined, path: string,
                        fileName?: string | null): string {
  if (!ref) return fileName || path.split('/').pop() || path;
  const ext = fileExt(path);
  const n = seq && seq > 1 ? `_${seq}` : '';
  return `${ref}${n}${ext ? `.${ext}` : ''}`;
}
