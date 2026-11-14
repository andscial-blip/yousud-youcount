import { Logo, Wordmark } from '@/components/Logo';
import { LoginForm } from './LoginForm';
import { supabaseConfigured } from '@/lib/supabase/env';
import { guestLang } from '@/lib/session';
import { translator } from '@/lib/i18n';
import { setLang } from '@/app/lang-action';
import { forgotPassword } from './actions';

export const dynamic = 'force-dynamic';

// Accesso come in Cairn: scheda al centro con marchio, nome, frase; email, password, Accedi, Password dimenticata.
export default async function Login({ searchParams }: { searchParams: Promise<{ sent?: string; err?: string }> }) {
  const { sent, err } = await searchParams;
  const lang = await guestLang();
  const t = translator(lang);
  return (
    <main className="auth">
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(t("lang_code"))}` }} />
      <section className="auth-card" aria-labelledby="t">
        <div className="auth-brand"><Logo size={72} /><h1 id="t" className="yc-wm"><span className="wm-you">You</span><span className="wm-count">Count</span></h1><p>{t('app_tagline')}</p></div>
        {supabaseConfigured ? (
          <LoginForm labels={{ email: t('email'), password: t('password'), btn: t('login_btn'), busy: t('login_busy'), bad: t('login_bad'), offline: t('login_offline') }} />
        ) : <div className="note err">{t('not_configured')}</div>}
        {sent && <div className="note ok" role="status" style={{ marginTop: 14 }}>{t('forgot_sent')}</div>}
        {err === 'link' && <div className="note err" style={{ marginTop: 14 }}>{t('link_err')}</div>}
        {supabaseConfigured && (
          <details style={{ marginTop: 6 }}>
            <summary className="btn ghost" style={{ width: '100%' }}>{t('forgot')}</summary>
            <form action={forgotPassword} className="stack" style={{ gap: 10, marginTop: 10 }}>
              <div className="field"><label htmlFor="femail">{t('email')}</label>
                <input className="input" id="femail" name="email" type="email" autoComplete="username" required /></div>
              <button className="btn" type="submit">{t('forgot_send')}</button>
            </form>
          </details>
        )}
        <p className="muted" style={{ fontSize: 13, textAlign: 'center', margin: '18px 0 0' }}>{t('login_invite')}</p>
        <form action={setLang} className="lang">
          <input type="hidden" name="back" value="/login" />
          <div className="seg">
            <button name="lang" value="it" aria-pressed={lang === 'it'}>Italiano</button>
            <button name="lang" value="fr" aria-pressed={lang === 'fr'}>Français</button>
          </div>
        </form>
      </section>
    </main>
  );
}
