import { ICONS } from '@/lib/cairn-icons';

// Icona nello stile di Cairn (tratto 1,8).
export function CIcon({ name, size = 16 }: { name: string; size?: number }) {
  const p = ICONS[name];
  if (!p) return null;
  return <svg className="ic" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: p }} />;
}
