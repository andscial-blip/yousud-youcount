import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { guestLang } from '@/lib/session';
import { translator } from '@/lib/i18n';

export default async function NotFound() {
  const t = translator(await guestLang());
  return (
    <main className="auth">
      <section className="auth-card">
        <div className="auth-brand"><Logo size={72} /><h1 className="yc-wm"><span className="wm-you">You</span><span className="wm-count">Count</span></h1></div>
        <h2 style={{ fontSize: 20, margin: '0 0 10px', textAlign: 'center' }}>{t('nf_title')}</h2>
        <div className="note">{t('nf_text')}</div>
        <div className="row-btns eq" style={{ marginTop: 14 }}><Link className="btn primary" href="/">{t('nf_home')}</Link></div>
      </section>
    </main>
  );
}
