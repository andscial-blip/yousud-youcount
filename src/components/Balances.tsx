import type { Lang, T } from '@/lib/i18n';
import { money, nm } from '@/lib/format';
import { Place } from './Ui';

export type Balance = {
  account_id: string; code: string; name_it: string; name_fr: string; currency: 'EUR' | 'MGA'; kind: string; location: string;
  opening_balance: string; movements_in: string; movements_out: string; balance: string; unverified: number;
};

export function BalancesTable({ rows, t, lang, detail = false, noPlace = false }: { rows: Balance[]; t: T; lang: Lang; detail?: boolean; noPlace?: boolean }) {
  return (
    <>
    {/* telefono: una scheda per conto (nome e saldo sulla stessa riga, dettagli sotto a pezzi interi) */}
    <ul className="bal-cards">
      {rows.map((r) => (
        <li key={r.account_id}>
          <div className="bc-top"><b>{nm(lang, r)}</b>
            <span className={`num bc-bal${Number(r.balance) < 0 ? ' neg' : ''}`}>{money(r.balance, r.currency, lang)}</span></div>
          {detail && <div className="bc-det num">
            <span>{t('acc_opening')} {money(r.opening_balance, r.currency, lang)}</span>
            <span>{t('acc_in')} {money(r.movements_in, r.currency, lang)}</span>
            <span>{lang === 'fr' ? 'Sorties' : 'Uscite'} {money(r.movements_out, r.currency, lang)}</span>
          </div>}
          {r.unverified > 0 && <span className="chip warn tiny">{r.unverified} {t('nav_verify').toLowerCase()}</span>}
        </li>
      ))}
    </ul>
    <table className={`t keep bal-t${detail ? ' bal-fixed' : ''}`}>
      {/* stesse larghezze in ogni tabella (Italia, Madagascar): le colonne restano allineate tra un riquadro e l'altro */}
      {detail && (noPlace
        ? <colgroup><col style={{ width: '28%' }} /><col style={{ width: '15%' }} /><col style={{ width: '15%' }} /><col style={{ width: '16%' }} /><col style={{ width: '15%' }} /><col style={{ width: '11%' }} /></colgroup>
        : <colgroup><col style={{ width: '25%' }} /><col style={{ width: '8%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} />
          <col style={{ width: '17%' }} /><col style={{ width: '14%' }} /><col style={{ width: '8%' }} /></colgroup>)}
      <thead>
        <tr>
          <th>{t('account')}</th>{!noPlace && <th>{t('place')}</th>}
          {detail && <><th className="r">{t('acc_opening')}</th><th className="r">{t('acc_in')}</th><th className="r">{t('acc_out')}</th></>}
          <th className="r">{t('balance')}</th><th className="r">{t('nav_verify')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.account_id}>
            <td>{nm(lang, r)}</td>
            {!noPlace && <td><Place loc={r.location} label={r.location === 'IT' ? t('italy') : t('madagascar')} /></td>}
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
    </>
  );
}
