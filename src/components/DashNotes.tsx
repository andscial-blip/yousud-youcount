'use client';
import { useActionState, useState } from 'react';
import { saveDashNotes } from '@/app/(app)/notes-action';

// Note libere della Dashboard, condivise nell'ente: si scrivono qui e si salvano con il pulsante.
export function DashNotes({ text, meta, canWrite, lang }: { text: string; meta: string; canWrite: boolean; lang: 'it' | 'fr' }) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const [val, setVal] = useState(text);
  const [state, act, pending] = useActionState(saveDashNotes, { ok: false, err: '', meta });
  return (
    <form action={act} className="dnotes">
      <textarea className="input" name="text" rows={5} maxLength={4000} value={val} readOnly={!canWrite}
        onChange={(e) => setVal(e.target.value)} aria-label={L('Note', 'Notes')}
        placeholder={canWrite ? L('Promemoria per il gruppo: cose da ricordare, accordi, numeri utili…', 'Mémo pour l\'équipe : choses à retenir, accords, numéros utiles…') : ''} />
      <div className="dn-f">
        <small className="muted">{state.err ? <span className="neg">{state.err}</span> : state.meta}</small>
        {canWrite && <button className="btn small" type="submit" disabled={pending}>
          {pending ? L('Salvataggio…', 'Enregistrement…') : L('Salva', 'Enregistrer')}</button>}
      </div>
    </form>
  );
}
