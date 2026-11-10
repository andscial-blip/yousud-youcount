import Link from 'next/link';
import { Suspense } from 'react';
import { Logo, Splash, Wordmark } from '@/components/Logo';
import { SyncBadge, SyncEngine } from '@/components/NetStatus';
import { TableCards } from '@/components/TableCards';
import { PerfBeacon } from '@/components/PerfBeacon';
import { Prefetcher } from '@/components/Prefetcher';
import { LinkRouter } from '@/components/LinkRouter';
import { Tooltip } from '@/components/Tooltip';
import { CIcon } from '@/components/CIcon';
import { SignOut } from '@/components/SignOut';
import { BottomNav, PageHeader, SideNav, type NavSec } from '@/components/Shell';
import { supabaseConfigured } from '@/lib/supabase/env';
import { guestLang, requireMe } from '@/lib/session';
import { translator, type T } from '@/lib/i18n';
import { navFor } from '@/lib/nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) {
    const t = translator(await guestLang());
    return <Bare t={t}><div className="note err">{t('not_configured_long')}</div></Bare>;
  }
  const { me, t, lang } = await requireMe();
  if (!me || !me.active) return <Bare t={t}><div className="note err">{t(me ? 'account_suspended' : 'account_noprofile')}</div></Bare>;
  const secs: NavSec[] = navFor(me.role).map((s) => ({
    id: s.id, label: t(s.key), hint: t(s.hint), ic: s.ic, also: s.also, subs: s.subs.map((x) => ({ href: x.href, label: t(x.key) })),
  }));
  const canWrite = me.role !== 'read_only';
  const cy = new Date().getFullYear();
  const years = Array.from({ length: cy + 2 - 2022 }, (_, i) => cy + 1 - i);
  const syncL = { ok: t('sync_ok'), offline: t('sync_off'), pending: t('sync_wait') };
  const warn = t('q_signout_warn');
  // prima le schede della barra in basso, poi le altre sezioni
  const pre = [...new Set(['/movimenti', '/conti', ...(canWrite ? ['/nuovo'] : []), '/', ...secs.map((s) => s.subs[0]?.href).filter((h): h is string => Boolean(h))])];
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(t('lang_code'))}` }} />
      <a className="skip" href="#main">{t('skip_main')}</a>
      <Splash tagline={t('app_tagline')} />
      <SyncEngine />
      <div className="app">
        <aside className="side" aria-label={t('nav_sections')}>
          <Link href="/" className="side-brand" aria-label={`YouCount, ${t('nav_dashboard')}`}><Logo /><Wordmark /></Link>
          <SideNav secs={secs} label={t('nav_sections')} />
          <div className="side-foot">
            <SyncBadge labels={syncL} lang={lang} />
            <Link className="side-who" href="/account" title={t('nav_account')}><CIcon name="user" size={16} /><span>{me.full_name || t('nav_account')}<small className="side-role"> · {t(`r_${me.role}` as 'r_operator')}</small></span></Link>
            <SignOut variant="side" label={t('sign_out_short')} warn={warn} icon={<CIcon name="logout" size={18} />} />
          </div>
        </aside>
        <div className="col">
          <Suspense fallback={<header className="phead"><div className="phead-row" /></header>}>
            <PageHeader secs={secs} canWrite={canWrite} years={years}
              labels={{ lang, search: t('cmd_search'), year: t('year_label'), newMov: t('nav_new_long').replace('+ ', ''), subnav: t('nav_sections'), brand: 'YouCount', cmdPh: t('cmd_ph'), searchMov: t('cmd_mov'), goTo: t('cmd_go'), none: t('cmd_none') }}
              phoneBrand={<><Logo size={32} /><b className="yc-wm pb-wm pb-stack" aria-label="YouCount"><span className="wm-you" aria-hidden="true">You</span><span className="wm-count" aria-hidden="true">Count</span></b></>} phoneSync={<SyncBadge labels={syncL} compact lang={lang} />} />
          </Suspense>
          <main className="main" id="main" tabIndex={-1}><div id="app" className="view">{children}</div></main>
        </div>
        <BottomNav secs={secs} canWrite={canWrite}
          labels={{ more: t('nav_more'), home: lang === 'fr' ? 'Accueil' : undefined, newMov: t('nav_new_long').replace('+ ', ''), other: t('nav_sections'), close: t('close'),
                    signOut: <SignOut variant="menu" label={t('sign_out')} warn={warn} icon={<CIcon name="logout" size={20} />} /> }} />
      </div>
      <TableCards />
      <Tooltip />
      <PerfBeacon />
      <Prefetcher hrefs={pre} />
      <LinkRouter />
    </>
  );
}

function Bare({ t, children }: { t: T; children: React.ReactNode }) {
  return (
    <div className="auth"><div className="auth-card">
      <div className="auth-brand"><Logo size={72} /><Wordmark as="h1" /><p>{t('app_tagline')}</p></div>
      {children}
    </div></div>
  );
}
