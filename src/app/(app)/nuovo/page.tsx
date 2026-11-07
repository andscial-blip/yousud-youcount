import { can, requireMe } from '@/lib/session';
import { dictFor } from '@/lib/i18n';
import { loadRefData } from '@/lib/movement-ref';
import { Denied, PageHead } from '@/components/Page';
import { MovementForm } from '@/components/MovementForm';

export const dynamic = 'force-dynamic';

export default async function NewMovement() {
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ['super_admin', 'admin', 'responsabile', 'operator'])) return <Denied text={t('err_forbidden')} />;
  const refData = await loadRefData(supabase, me!, lang);
  return (
    <div className="stack">
      <PageHead title={t('f_new_title')} />
      <MovementForm refData={refData} t={dictFor(lang)} />
    </div>
  );
}
