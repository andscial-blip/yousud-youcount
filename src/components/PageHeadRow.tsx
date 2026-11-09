'use client';
import { usePathname } from 'next/navigation';
import { SUB_HREFS } from '@/lib/nav';

// Riga del titolo nella pagina. Nelle pagine che sono una sotto-scheda il titolo è già nell'intestazione (come in Cairn):
// qui resta solo per i lettori di schermo e la riga mostra soltanto le azioni.
export function PageHeadRow({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return <div className={`h1row${SUB_HREFS.includes(path) ? ' sec-root' : ''}`}>{children}</div>;
}
