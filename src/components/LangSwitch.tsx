'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { setLang } from '@/app/lang-action';

// Cambio lingua sempre a portata di mano nell'intestazione: IT ↔ FR (resta sulla stessa pagina).
export function LangSwitch({ lang }: { lang: 'it' | 'fr' }) {
  const path = usePathname();
  const sp = useSearchParams().toString();
  const other = lang === 'it' ? 'fr' : 'it';
  return (
    <form action={setLang} className="langsw">
      <input type="hidden" name="back" value={sp ? `${path}?${sp}` : path} />
      <button className="btn ghost" name="lang" value={other}
        title={other === 'fr' ? 'Langue : FR' : 'Lingua: IT'} aria-label={other === 'fr' ? 'Langue : FR' : 'Lingua: IT'}>{other.toUpperCase()}</button>
    </form>
  );
}
