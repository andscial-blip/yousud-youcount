import type { Lang, T } from '@/lib/i18n';
import { money, nm } from '@/lib/format';

export type Balance = {
  account_id: string; code: string; name_it: string; name_fr: string; currency: 'EUR' | 'MGA'; kind: string; location: string;
  opening_balance: string; movements_in: string; movements_out: string; balance: string; unverified: number;
};

export function BalancesTable({ rows, t, lang, detail = false }: { rows: Balance[]; t: T; lang: Lang; detail?: boolean }) {
  return (
    <table className="t">
      <thead>
        <tr>
          <th>{t('account')}</th><th>{t('place')}</th>
          {detail && <><th className="r">{t('acc_opening')}</th><th className="r">{t('acc_in')}</th><th className="r">{t('acc_out')}</th></>}
          <th className="r">{t('balance')}</th><th className="r">{t('nav_verify')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.account_id}>
            <td>{nm(lang, r)}</td>
            <td className="muted">{r.location === 'IT' ? t('italy') : t('madagascar')}</td>
            {detail && <>
              <td className="r num">{money(r.opening_balance, r.currency, lang)}</td>
              <td className="r num">{money(r.movements_in, r.currency, lang)}</td>
              <td className="r num">{money(r.movements_out, r.currency, lang)}</td>
            </>}
            <td className="r num" style={Number(r.balance) < 0 && r.kind === 'cash' ? { color: 'var(--red)', fontWeight: 600 } : undefined}>
              {money(r.balance, r.currency, lang)}</td>
            <td className="r num">{r.unverified > 0 ? <span className="chip warn">{r.unverified}</span> : '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
