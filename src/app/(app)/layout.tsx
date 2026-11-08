import Link from 'next/link';
import { Logo, Splash, Wordmark } from '@/components/Logo';
import { BottomNav, SideNav, Icon, type NavLink } from '@/components/Nav';
import { NetStatus } from '@/components/NetStatus';
import { TableCards } from '@/components/TableCards';
import { I } from '@/lib/icons';
import { supabaseConfigured } from '@/lib/supabase/env';
import { guestLang, requireMe } from '@/lib/session';
import { translator, type T } from '@/lib/i18n';
import { visible } from '@/lib/nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) {
    const t = translator(await guestLang());
    return <Shell t={t} who={null} side={[]} bottom={[]}><div className="note err">{t('not_configured_long')}</div></Shell>;
  }
  const { me, t } = await requireMe();
  if (!me || !me.active) {
    return <Shell t={t} who={null} side={[]} bottom={[]}>
      <div className="note err">{t(me ? 'account_suspended' : 'account_noprofile')}</div>
    </Shell>;
  }
  const secs = visible(me.role);
  const link = (s: (typeof secs)[number]) => ({ href: s.href, label: t(s.key), icon: s.icon });
  return (
    <Shell t={t} who={`${me.full_name || ''} · ${t(`r_${me.role}`)}`}
           side={([['main', null], ['control', t('side_control')], ['treasury', t('side_treasury')], ['archive', t('side_archive')]] as const)
             .map(([k, title]) => ({ title, items: secs.filter((s) => s.side === k).map(link) })).filter((g) => g.items.length > 0)}
           bottom={secs.filter((s) => s.bottom).map(link)}>
      {children}
    </Shell>
  );
}

function Shell({ t, who, side, bottom, children }: {
  t: T; who: string | null; side: { title: string | null; items: NavLink[] }[];
  bottom: { href: string; label: string; icon: string }[]; children: React.ReactNode;
}) {
  const net = who ? <NetStatus labels={{ online: t('net_online'), offline: t('net_offline'), pending: t('q_pending') }} /> : null;
  return (
    <>
      {/* lingua della pagina per lettori di schermo e sillabazione: quella scelta dall'utente */}
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(t('lang_code'))}` }} />
      <a className="skip" href="#main">{t('skip_main')}</a>
      <Splash tagline={t('app_tagline')} />
      <div className={`app${side.length ? '' : ' noside'}`}>
        {side.length > 0 && (
          <aside className="side">
            <Link href="/" className="side-brand" aria-label={t('nav_dashboard')}><Logo /><Wordmark tagline={t('app_tagline')} /></Link>
            <Link className="btn primary side-new" href="/nuovo"><Icon d={I.plus} size={16} /><span>{t('nav_new_long').replace('+ ', '')}</span></Link>
            <SideNav groups={side} label={t('nav_sections')} />
            <div className="side-foot">
              {net}
              <Link className="side-link" href="/altro" title={t('nav_more')}><Icon d="M5 12h.01M12 12h.01M19 12h.01" size={18} /><span>{t('nav_more')}</span></Link>
              {who && <Link className="side-who" href="/account">{who}</Link>}
            </div>
          </aside>
        )}
        <div className="col">
          <header className="top">
            <div className="wrap">
              <Link href="/" aria-label={t('nav_dashboard')} style={{ display: 'flex' }}><Logo /></Link>
              <Wordmark tagline={t('app_tagline')} />
              <div className="spacer" />
              {net}
              {who && <Link className="btn ghost mob" href="/altro" aria-label={t('nav_more')} style={{ color: '#fff' }}>
                <Icon d="M4 7h16M4 12h16M4 17h16" size={20} /></Link>}
            </div>
          </header>
          <main className="wrap" id="main" tabIndex={-1}>{children}</main>
        </div>
      </div>
      <TableCards />
      {bottom.length > 0 && <BottomNav items={bottom} />}
    </>
  );
}
