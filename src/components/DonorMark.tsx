import { CIcon } from './CIcon';

// Segno del finanziatore: il logo se c'è, altrimenti le iniziali su una tinta tenue che dipende dal nome (sempre la stessa
// per lo stesso nome); icona grigia neutra quando il finanziatore non è indicato. Stesso riquadro bianco in tutti i casi.
const TINTS = ['var(--dn2)', 'var(--dn3)', 'var(--dn4)', 'var(--dn6)', 'var(--green-soft)', 'var(--vz-plan)'];
export function initials(name: string) {
  const w = name.replace(/[^\p{L}\p{N}\s&]/gu, ' ').split(/\s+/).filter((x) => x.length > 1 && !/^(di|de|del|della|des|du|la|le|per|pour|the|of|and|et|e)$/i.test(x));
  return ((w[0]?.[0] ?? name[0] ?? '?') + (w[1]?.[0] ?? '')).toUpperCase();
}
export function DonorMark({ name, logo, size = 40 }: { name?: string | null; logo?: string | null; size?: number }) {
  const st = { width: size, height: size, fontSize: Math.round(size * 0.36) };
  if (logo) return (
    // eslint-disable-next-line @next/next/no-img-element
    <span className="dmark has" style={st}><img src={logo} alt="" /></span>
  );
  if (!name) return <span className="dmark none" style={st} aria-hidden="true"><CIcon name="users" size={Math.round(size * 0.5)} /></span>;
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return <span className="dmark mono" style={{ ...st, background: `color-mix(in srgb, ${TINTS[h % TINTS.length]} 30%, var(--surface))` }} aria-hidden="true">{initials(name)}</span>;
}
