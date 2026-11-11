import type { Lang, T } from '@/lib/i18n';
import Link from 'next/link';
import { money, nm } from '@/lib/format';
import { Place } from './Ui';

export type Balance = {
  account_id: string; code: string; name_it: string; name_fr: string; currency: 'EUR' | 'MGA'; kind: string; location: string;
  opening_balance: string; movements_in: string; movements_out: string; balance: string; unverified: number;
};

export function BalancesTable({ rows, t, lang, detail = false, noPlace = false, hrefFor, verHref }: { rows: Balance[]; t: T; lang: Lang; detail?: boolean; noPlace?: boolean;
  hrefFor?: (r: Balance) => string; verHref?: (r: Balance) => string }) {
  // saldo: verde se positivo, rosso se negativo
  const tone = (r: Balance) => (Number(r.balance) > 0 ? ' pos' : Number(r.balance) < 0 ? ' neg' : '');
  const nameOf = (r: Balance) => (hrefFor ? <Link className="bal-a" href={hrefFor(r)} scroll={false}>{nm(lang, r)}</Link> : nm(lang, r));
  const ver = (r: Balance, tiny = false) => { const c = `chip warn${tiny ? ' tiny' : ''}`, tx = tiny ? `${r.unverified} ${t('nav_verify').toLowerCase()}` : String(r.unverified);
    return verHref ? <Link className={c} href={verHref(r)} title={t('nav_verify')}>{tx}</Link> : <span className={c}>{tx}</span>; };
  return (
    <>
    {/* telefono: una scheda per conto (nome e saldo sulla stessa riga, dettagli sotto a pezzi interi) */}
    <ul className="bal-cards">
      {rows.map((r) => (
        <li key={r.account_id}>
          <div className="bc-top"><b>{nameOf(r)}</b>
            <span className={`num bc-bal${tone(r)}`}>{money(r.balance, r.currency, lang)}</span></div>
          {detail && <dl className="bc-det">
            <div><dt>{lang === 'fr' ? 'Initial' : 'Iniziale'}</dt><dd className="num">{money(r.opening_balance, r.currency, lang)}</dd></div>
            <div><dt>{t('acc_in')}</dt><dd className="num">{money(r.movements_in, r.currency, lang)}</dd></div>
            <div><dt>{lang === 'fr' ? 'Sorties' : 'Uscite'}</dt><dd className="num">{money(r.movements_out, r.currency, lang)}</dd></div>
          </dl>}
          {r.unverified > 0 && ver(r, true)}
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
            <td>{nameOf(r)}</td>
            {!noPlace && <td><Place loc={r.location} label={r.location === 'IT' ? t('italy') : t('madagascar')} /></td>}
            {detail && <>
              <td className="r num">{money(r.opening_balance, r.currency, lang)}</td>
              <td className="r num">{money(r.movements_in, r.currency, lang)}</td>
              <td className="r num">{money(r.movements_out, r.currency, lang)}</td>
            </>}
            <td className={`r num bal-v${tone(r)}`}>{money(r.balance, r.currency, lang)}</td>
            <td className="r num">{r.unverified > 0 ? ver(r) : '–'}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </>
  );
}
