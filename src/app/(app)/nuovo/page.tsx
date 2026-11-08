import { can, requireMe } from '@/lib/session';
import { dictFor } from '@/lib/i18n';
import { loadRefData } from '@/lib/movement-ref';
import { Denied, PageHead } from '@/components/Page';
import { MovementForm, type Prefill } from '@/components/MovementForm';

export const dynamic = 'force-dynamic';

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

// ?tipo=expense|income&data=AAAA-MM-GG&importo=12.5&conto=<id>&desc=… (da una riga dell'estratto conto)
export default async function NewMovement({ searchParams }: { searchParams: SP }) {
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ['super_admin', 'admin', 'responsabile', 'operator'])) return <Denied text={t('err_forbidden')} />;
  const refData = await loadRefData(supabase, me!, lang);
  const sp = await searchParams;
  const kind = one(sp.tipo);
  const date = one(sp.data);
  const amount = Number(one(sp.importo));
  const account = one(sp.conto);
  const prefill: Prefill = {
    kind: kind === 'income' || kind === 'expense' ? kind : undefined,
    op_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : undefined,
    account_id: refData.accounts.some((a) => a.id === account) ? account : undefined,
    description: one(sp.desc).slice(0, 300) || undefined,
  };
  const has = Object.values(prefill).some((v) => v !== undefined);
  return (
    <div className="stack">
      <PageHead title={t('f_new_title')} />
      {has && <div className="note info">{t('f_prefill_stmt')}</div>}
      <MovementForm refData={refData} t={dictFor(lang)} prefill={has ? prefill : undefined} />
    </div>
  );
}
