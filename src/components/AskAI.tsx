'use client';
import { useRef, useState } from 'react';
import { CIcon } from './CIcon';

type QA = { q: string; a: string; err?: boolean };

// «Chiedi all'AI»: domande in linguaggio normale sui conti dell'anno; le risposte usano solo i dati dell'app.
export function AskAI({ year, lang, suggestions }: { year: number; lang: 'it' | 'fr'; suggestions: string[] }) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<QA[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const ERR: Record<string, string> = {
    ai_disabled: L('L\'AI non è attiva: un amministratore la attiva in Impostazioni › Ente e documenti («Lettura dei documenti con l\'AI»).', 'L\'IA n\'est pas activée : un administrateur l\'active dans Paramètres › Organisme et documents.'),
    ai_not_configured: L('Manca la chiave dell\'AI sul server.', 'La clé de l\'IA manque sur le serveur.'),
  };
  const ask = async (text: string) => {
    const question = text.trim();
    if (question.length < 3 || busy) return;
    setBusy(true); setQ('');
    try {
      const r = await fetch('/api/v1/ask', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q: question, year, history: log.filter((x) => !x.err).slice(-4) }) });
      const j = await r.json().catch(() => ({}));
      setLog((l) => [...l, r.ok ? { q: question, a: String(j.answer ?? '') } : { q: question, a: ERR[j.error] ?? L('Non è stato possibile rispondere. Riprova tra poco.', 'Impossible de répondre. Réessayez dans un instant.'), err: true }]);
    } catch {
      setLog((l) => [...l, { q: question, a: L('Serve la connessione a internet.', 'Une connexion internet est nécessaire.'), err: true }]);
    } finally {
      setBusy(false);
      setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
    }
  };
  return (
    <div className="ask">
      {log.length === 0 && (
        <div className="ask-sug">
          {suggestions.map((s) => <button key={s} type="button" className="chip ask-chip" onClick={() => ask(s)} disabled={busy}>{s}</button>)}
        </div>
      )}
      <div className="ask-log" aria-live="polite">
        {log.map((x, i) => (
          <div key={i} className="ask-qa">
            <p className="ask-q">{x.q}</p>
            <div className={`ask-a${x.err ? ' err' : ''}`}><CIcon name="spark" size={16} /><div>{x.a.split(/\n{2,}/).map((p, k) => <p key={k}>{p}</p>)}</div></div>
          </div>
        ))}
        {busy && <div className="ask-qa"><div className="ask-a wait"><CIcon name="spark" size={16} /><div><p>{L('Sto guardando i dati…', 'Je regarde les données…')}</p></div></div></div>}
        <div ref={end} />
      </div>
      <form className="ask-in" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <textarea className="input" rows={2} value={q} maxLength={600} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(q); } }}
          placeholder={L('Scrivi una domanda sui conti…', 'Posez une question sur les comptes…')} aria-label={L('Domanda', 'Question')} />
        <button className="btn primary" type="submit" disabled={busy || q.trim().length < 3}><CIcon name="send" size={16} />{L('Chiedi', 'Demander')}</button>
      </form>
      <p className="muted small" style={{ margin: 0 }}>{L('Le risposte usano solo i dati che puoi vedere nell\'app; controlla sempre le cifre importanti. Le domande vanno al servizio AI configurato dall\'associazione.',
        'Les réponses utilisent seulement les données que vous voyez dans l\'application ; vérifiez toujours les chiffres importants.')}</p>
    </div>
  );
}
