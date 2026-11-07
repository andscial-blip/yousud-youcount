import { ADMIN, can, requireMe } from '@/lib/session';
import { money, nm } from '@/lib/format';
import { Denied, Empty, ErrorNote, PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

const KIND: Record<string, [string, string]> = {
  bank: ['Banca', 'Banque'], cash: ['Cassa', 'Caisse'], mobile: ['Mobile money / online', 'Mobile money / en ligne'],
  advance: ['Anticipi', 'Avances'], other: ['Altro', 'Autre'],
};

export default async function AdminAccounts() {
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const { data, error } = await supabase.from('accounts')
    .select('id, code, name_it, name_fr, currency, location, kind, opening_balance, opening_date, active').order('sort');
  return (
    <div className="stack">
      <PageHead title={t('nav_admin_accounts')} />
      <p className="muted" style={{ margin: 0 }}>{t('admin_readonly')}</p>
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {(data ?? []).length === 0 ? <Empty text={t('none')} /> : (
          <table className="t">
            <thead><tr><th>{t('name')}</th><th>{t('type')}</th><th>{t('place')}</th><th>{t('currency')}</th>
              <th className="r">{t('acc_opening')}</th><th>{t('status')}</th></tr></thead>
            <tbody>
              {data!.map((a) => (
                <tr key={a.id}>
                  <td>{nm(lang, a)}</td><td>{KIND[a.kind]?.[lang === 'fr' ? 1 : 0] ?? a.kind}</td>
                  <td>{a.location === 'IT' ? t('italy') : t('madagascar')}</td><td>{a.currency}</td>
                  <td className="r num">{money(a.opening_balance, a.currency, lang)}</td>
                  <td><span className={`chip ${a.active ? 'ok' : ''}`}>{a.active ? t('active') : '–'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
