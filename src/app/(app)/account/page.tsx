import { requireMe } from '@/lib/session';
import { PageHead, Panel } from '@/components/Page';
import { SignOut } from '@/components/SignOut';
import { setLang } from '@/app/lang-action';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function Account() {
  const { me, user, t, lang } = await requireMe();
  return (
    <div className="stack">
      <PageHead title={t('nav_account')} />
      <Panel pad>
        <div className="stack" style={{ gap: 14 }}>
          <div><span className="muted">{t('name')}</span><br />{me?.full_name || '–'}</div>
          <div><span className="muted">{t('email')}</span><br />{user.email}</div>
          <div><span className="muted">{t('role')}</span><br />{me ? t(`r_${me.role}`) : '–'}</div>
          <div>
            <span className="muted">{t('acc_lang')}</span><br />
            <form action={setLang} className="seg" style={{ marginTop: 4 }}>
              <input type="hidden" name="back" value="/account" />
              <button name="lang" value="it" aria-pressed={lang === 'it'}>Italiano</button>
              <button name="lang" value="fr" aria-pressed={lang === 'fr'}>Français</button>
            </form>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn" href="/account/password">{t('pw_change')}</Link>
            <SignOut label={t('sign_out')} warn={t('q_signout_warn')} />
          </div>
        </div>
      </Panel>
    </div>
  );
}
