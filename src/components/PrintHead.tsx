import { loadOrg } from '@/lib/org';

// Intestazione che compare solo sul foglio stampato (o nel PDF): ente, titolo del documento, data.
// Serve a rendiconti e report, che prima uscivano come «la pagina dell'app» senza nome dell'ente né titolo.
export async function PrintHead({ sb, title, sub, lang, draft }: {
  sb: { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  title: string; sub?: string; lang: string; draft?: boolean;
}) {
  const org = await loadOrg(sb);
  const now = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Indian/Antananarivo' });
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  return (
    <header className="print-head" aria-hidden="true">
      <div className="ph-org">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {org.logo && <img src={`data:${org.logo.mime};base64,${org.logo.data}`} alt="" />}
        <div><b>{org.name}</b>
          {org.address && <span>{org.address}</span>}
          {(org.tax_id || org.runts) && <span>{[org.tax_id && `${L('Codice fiscale', 'Code fiscal')} ${org.tax_id}`, org.runts && `RUNTS ${org.runts}`].filter(Boolean).join(' · ')}</span>}</div>
      </div>
      <h1>{title}</h1>
      <p>{[sub, draft ? L(`Bozza del ${now}: non ancora approvato`, `Projet du ${now} : pas encore approuvé`) : L(`Stampato il ${now}`, `Imprimé le ${now}`)].filter(Boolean).join(' · ')}</p>
    </header>
  );
}

// Spazio per le firme in fondo al rendiconto stampato.
export function PrintSign({ lang }: { lang: string }) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  return (
    <footer className="print-sign" aria-hidden="true">
      <div><i />{L('Il presidente', 'Le président')}</div>
      <div><i />{L('Il tesoriere', 'Le trésorier')}</div>
    </footer>
  );
}
