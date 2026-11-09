import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { navFor } from '@/lib/nav';
import { CIcon } from '@/components/CIcon';
import { SearchBox } from '@/components/Page';
import { SignOut } from '@/components/SignOut';

export const dynamic = 'force-dynamic';

// Tutte le sezioni e le loro schede (telefono e collegamenti diretti), come l'elenco «Altre sezioni» di Cairn.
export default async function More() {
  const { me, t } = await requireMe();
  const secs = navFor(me?.role);
  return (
    <div className="stack">
      <SearchBox action="/movimenti" value="" placeholder={t('search_mov')} clearLabel={t('search_clear')} />
      {secs.map((s) => (
        <section className="panel" key={s.id}>
          <div className="panel-h"><h2><CIcon name={s.ic} size={18} />{t(s.key)}</h2><div className="spacer" /><span className="eyebrow">{t(s.hint)}</span></div>
          <div className="panel-b">
            <ul className="menu-list">
              {s.subs.map((x) => <li key={x.href}><Link href={x.href}><CIcon name="arrow" size={18} /><span><b>{t(x.key)}</b></span></Link></li>)}
            </ul>
          </div>
        </section>
      ))}
      <div><SignOut label={t('sign_out')} warn={t('q_signout_warn')} /></div>
    </div>
  );
}
