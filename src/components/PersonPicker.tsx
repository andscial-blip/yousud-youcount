'use client';
import { useState } from 'react';

// Scelta della persona che riceve o restituisce un anticipo: chi ha già un conto anticipi, un utente dell'app,
// oppure «Altra persona…» con il nome scritto (anche se non è utente). Valori: acc:<conto> · usr:<profilo> · new.
// Per utente o persona nuova chiede anche la valuta, se serve (il conto anticipi si crea da solo, uno per valuta).
export function PersonPicker({ id, label, accounts, users, lang, currency = true, def, defCur }: {
  id: string; label: string; lang: 'it' | 'fr'; currency?: boolean; def?: string; defCur?: string;
  accounts: { id: string; label: string }[]; users: { id: string; name: string }[];
}) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const [v, setV] = useState(def ?? (accounts[0] ? `acc:${accounts[0].id}` : users[0] ? `usr:${users[0].id}` : 'new'));
  return (
    <>
      <div className="field"><label htmlFor={id}>{label}</label>
        <select className="input" id={id} name="person" value={v} onChange={(e) => setV(e.target.value)} required>
          {accounts.length > 0 && <optgroup label={L('Con un conto anticipi', 'Avec un compte d’avances')}>
            {accounts.map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.label}</option>)}</optgroup>}
          {users.length > 0 && <optgroup label={L('Utenti dell’app', 'Utilisateurs de l’app')}>
            {users.map((u) => <option key={u.id} value={`usr:${u.id}`}>{u.name}</option>)}</optgroup>}
          <option value="new">{L('Altra persona…', 'Autre personne…')}</option>
        </select></div>
      {v === 'new' && (
        <div className="field"><label htmlFor={`${id}-n`}>{L('Nome e cognome', 'Prénom et nom')}</label>
          <input className="input" id={`${id}-n`} name="holder" required minLength={2} maxLength={120} autoComplete="off"
                 placeholder={L('Anche se non è utente dell’app', 'Même si ce n’est pas un utilisateur')} /></div>
      )}
      {currency && (
        <div className="field"><label htmlFor={`${id}-c`}>{L('Valuta', 'Devise')}</label>
          <select className="input" id={`${id}-c`} name="currency" defaultValue={defCur ?? 'MGA'}><option>MGA</option><option>EUR</option></select></div>
      )}
    </>
  );
}

