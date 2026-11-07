import { requireMe } from '@/lib/session';
import { PageHead } from '@/components/Page';

export const dynamic = 'force-dynamic';

export default async function NewMovement() {
  const { t } = await requireMe();
  return (
    <div className="stack">
      <PageHead title={t('nav_new_long').replace('+ ', '')} />
      <div className="note"><b>{t('coming')}.</b> {t('new_text')}</div>
    </div>
  );
}
