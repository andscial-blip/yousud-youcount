'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavLink = { href: string; label: string; icon: string };

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

export function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
  );
}

export function TopNav({ items }: { items: NavLink[] }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Sezioni">
      <div className="wrap">
        {items.map((i) => (
          <Link key={i.href} href={i.href} aria-current={isActive(path, i.href) ? 'page' : undefined}>{i.label}</Link>
        ))}
      </div>
    </nav>
  );
}

// Telefono: Dashboard, Movimenti, "+" al centro, Documenti, Altro.
export function BottomNav({ items }: { items: NavLink[] }) {
  const path = usePathname();
  return (
    <nav className="bnav" aria-label="Sezioni">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={i.href === '/nuovo' ? 'bplus' : undefined}
              aria-current={isActive(path, i.href) ? 'page' : undefined}>
          <Icon d={i.icon} />
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
