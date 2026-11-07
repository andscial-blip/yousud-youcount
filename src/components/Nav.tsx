'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Cruscotto', icon: 'M3 12l9-8 9 8M5 10v10h14V10' },
  { href: '/movimenti', label: 'Movimenti', icon: 'M4 6h16M4 12h16M4 18h10' },
  { href: '/nuovo', label: 'Nuovo', icon: 'M12 5v14M5 12h14', plus: true },
  { href: '/documenti', label: 'Documenti', icon: 'M7 3h7l5 5v13H7zM14 3v5h5' },
  { href: '/rendiconto', label: 'Rendiconto', icon: 'M5 20V10M12 20V4M19 20v-7' },
  { href: '/altro', label: 'Altro', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
];

const active = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href));

export function TopNav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Sezioni">
      <div className="wrap">
        {ITEMS.filter((i) => !i.plus).map((i) => (
          <Link key={i.href} href={i.href} aria-current={active(path, i.href) ? 'page' : undefined}>
            {i.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

// Telefono: quattro sezioni e il "+" al centro (Altro resta raggiungibile dal menu in alto).
export function BottomNav() {
  const path = usePathname();
  const items = ITEMS.filter((i) => i.href !== '/altro');
  return (
    <nav className="bnav" aria-label="Sezioni">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={i.plus ? 'bplus' : undefined}
              aria-current={active(path, i.href) ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
               strokeLinejoin="round" aria-hidden="true">
            <path d={i.icon} />
          </svg>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
