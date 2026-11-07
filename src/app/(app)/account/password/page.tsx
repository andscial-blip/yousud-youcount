import { requireMe } from '@/lib/session';
import { dictFor } from '@/lib/i18n';
import { PageHead, Panel } from '@/components/Page';
import { PasswordForm } from './PasswordForm';

export const dynamic = 'force-dynamic';

export default async function SetPassword() {
  const { t, lang } = await requireMe();
  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <PageHead title={t('pw_title')} />
      <Panel pad><PasswordForm t={dictFor(lang)} /></Panel>
    </div>
  );
}
