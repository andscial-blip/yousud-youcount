import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { visible } from '@/lib/nav';
import { Icon } from '@/components/Nav';
import { PageHead, SearchBox } from '@/components/Page';
import { SignOut } from '@/components/SignOut';

export const dynamic = 'force-dynamic';

// Tutte le sezioni non presenti nella barra del telefono, raggruppate.
export default async function More() {
  const { me, t } = await requireMe();
  const secs = visible(me?.role);
  const groups = [
    { k: 'grp_work' as const, items: secs.filter((s) => s.group === 'work') },
    { k: 'grp_admin' as const, items: secs.filter((s) => s.group === 'admin') },
    { k: 'grp_me' as const, items: secs.filter((s) => s.group === 'me') },
  ].filter((g) => g.items.length > 0);
  return (
    <div className="stack">
      <PageHead title={t('nav_more')} />
      <SearchBox action="/movimenti" value="" placeholder={t('search_mov')} clearLabel={t('search_clear')} />
      {groups.map((g) => (
        <div key={g.k} className="stack" style={{ gap: 12 }}>
          <h3 className="grp">{t(g.k)}</h3>
          <nav className="menu">
            {g.items.map((s) => <Link key={s.href} href={s.href}><Icon d={s.icon} />{t(s.key)}</Link>)}
          </nav>
        </div>
      ))}
      <div><SignOut label={t('sign_out')} warn={t('q_signout_warn')} /></div>
    </div>
  );
}
