import Link from 'next/link';
import { Logo, Wordmark } from '@/components/Logo';
import { BottomNav, TopNav, Icon } from '@/components/Nav';
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
    return <Shell t={t} who={null} top={[]} bottom={[]}><div className="note err">{t('not_configured_long')}</div></Shell>;
  }
  const { me, t } = await requireMe();
  if (!me || !me.active) {
    return <Shell t={t} who={null} top={[]} bottom={[]}>
      <div className="note err">{t(me ? 'account_suspended' : 'account_noprofile')}</div>
    </Shell>;
  }
  const secs = visible(me.role);
  const link = (s: (typeof secs)[number]) => ({ href: s.href, label: t(s.key), icon: s.icon });
  return (
    <Shell t={t} who={`${me.full_name || ''} · ${t(`r_${me.role}`)}`}
           top={secs.filter((s) => s.top).map(link)} bottom={secs.filter((s) => s.bottom).map(link)}>
      {children}
    </Shell>
  );
}

function Shell({ t, who, top, bottom, children }: {
  t: T; who: string | null; top: { href: string; label: string; icon: string }[];
  bottom: { href: string; label: string; icon: string }[]; children: React.ReactNode;
}) {
  return (
    <>
      <header className="top">
        <div className="wrap">
          <Link href="/" aria-label={t('nav_dashboard')} style={{ display: 'flex' }}><Logo /></Link>
          <Wordmark tagline={t('app_tagline')} />
          <div className="spacer" />
          {who && <NetStatus labels={{ online: t('net_online'), offline: t('net_offline'), pending: t('q_pending') }} />}
          {who && <Link href="/account" className="desk" style={{ color: 'rgba(255,255,255,.85)', fontSize: 13, textDecoration: 'none' }}>{who}</Link>}
          {who && <Link className="btn primary desk" href="/nuovo"><Icon d={I.plus} size={16} />{t('nav_new_long').replace('+ ', '')}</Link>}
          {who && <Link className="btn ghost mob" href="/altro" aria-label={t('nav_more')} style={{ color: '#fff' }}>
            <Icon d="M4 7h16M4 12h16M4 17h16" size={20} /></Link>}
        </div>
      </header>
      {top.length > 0 && <TopNav items={top} />}
      <main className="wrap">{children}</main>
      <TableCards />
      {bottom.length > 0 && <BottomNav items={bottom} />}
    </>
  );
}
