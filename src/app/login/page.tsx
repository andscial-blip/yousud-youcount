import { Logo, Wordmark } from '@/components/Logo';
import { LoginForm } from './LoginForm';
import { supabaseConfigured } from '@/lib/supabase/env';
import { guestLang } from '@/lib/session';
import { translator } from '@/lib/i18n';
import { setLang } from '@/app/lang-action';

export const dynamic = 'force-dynamic';

export default async function Login() {
  const lang = await guestLang();
  const t = translator(lang);
  return (
    <main className="wrap login" style={{ maxWidth: 420, paddingTop: 'calc(40px + env(safe-area-inset-top, 0px))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Logo size={52} />
        <Wordmark tagline={t('app_tagline')} />
        <div className="spacer" />
        <form action={setLang} className="seg">
          <input type="hidden" name="back" value="/login" />
          <button name="lang" value="it" aria-pressed={lang === 'it'}>IT</button>
          <button name="lang" value="fr" aria-pressed={lang === 'fr'}>FR</button>
        </form>
      </div>
      <section className="panel">
        <div className="panel-h"><h2>{t('login_title')}</h2></div>
        <div className="panel-b">
          {supabaseConfigured ? (
            <LoginForm labels={{ email: t('email'), password: t('password'), btn: t('login_btn'), busy: t('login_busy'),
                                  bad: t('login_bad'), offline: t('login_offline') }} />
          ) : <div className="note err">{t('not_configured')}</div>}
        </div>
      </section>
      <p className="muted" style={{ fontSize: 13 }}>{t('login_invite')}</p>
      <p className="muted" style={{ fontSize: 12 }}>{t('app_sub')}</p>
    </main>
  );
}
