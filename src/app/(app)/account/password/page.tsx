import { requireMe } from '@/lib/session';
import { dictFor } from '@/lib/i18n';
import { PageHead, Panel } from '@/components/Page';
import { PasswordForm } from './PasswordForm';

export const dynamic = 'force-dynamic';

export default async function SetPassword() {
  const { t, lang, supabase, user } = await requireMe();
  // Cambio volontario (sessione aperta con la password): si chiede anche la password attuale.
  // Da invito o da «password dimenticata» la sessione nasce dal link nell'email e la password attuale non c'è.
  const { data: cl } = await supabase.auth.getClaims();
  const amr = (cl?.claims?.amr ?? []) as { method?: string }[] | string[];
  const needCurrent = amr.some((a) => (typeof a === 'string' ? a : a.method) === 'password');
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <PageHead title={needCurrent ? t('pw_change') : t('pw_title')} />
      <Panel pad><PasswordForm t={dictFor(lang)} lang={lang} needCurrent={needCurrent} email={user.email} /></Panel>
    </div>
  );
}
