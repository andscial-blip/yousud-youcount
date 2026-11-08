'use client';
import { useActionState } from 'react';
import { createApiKey, revokeApiKey } from '@/app/(app)/admin/impostazioni/api-actions';

type Row = { id: string; name: string; key_prefix: string; created_at: string; last_used_at: string | null; revoked_at: string | null };
type L = { name: string; create: string; shown: string; copy: string; revoke: string; revoked: string; never: string;
  last: string; created: string; none: string; prefix: string };

// Chiavi per le app collegate: la chiave nuova si vede solo qui, una volta; poi resta solo l'impronta nel database.
export function ApiKeys({ rows, labels: t, lang }: { rows: Row[]; labels: L; lang: string }) {
  const [state, action, busy] = useActionState(createApiKey, null as null | { key?: string; err?: string });
  const fmt = (d: string) => new Date(d).toLocaleString(lang === 'fr' ? 'fr-FR' : 'it-IT', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <div className="panel-b stack" style={{ gap: 12 }}>
      {state?.key && (
        <div className="note ok" role="status" style={{ display: 'grid', gap: 6 }}>
          <span>{t.shown}</span>
          <code className="num" style={{ overflowWrap: 'anywhere', userSelect: 'all' }}>{state.key}</code>
          <div><button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(state.key!)}>{t.copy}</button></div>
        </div>
      )}
      {state?.err && <div className="note err" role="alert">{state.err}</div>}
      {rows.length === 0 ? <p className="muted" style={{ margin: 0 }}>{t.none}</p> : (
        <table className="t">
          <thead><tr><th>{t.name}</th><th>{t.prefix}</th><th className="hm">{t.created}</th><th>{t.last}</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.revoked_at ? 'muted' : undefined}>
                <td>{r.name}{r.revoked_at && <> <span className="chip">{t.revoked}</span></>}</td>
                <td className="num">{r.key_prefix}…</td>
                <td className="num hm">{fmt(r.created_at)}</td>
                <td className="num">{r.last_used_at ? fmt(r.last_used_at) : t.never}</td>
                <td className="r">{!r.revoked_at && (
                  <form action={revokeApiKey}><input type="hidden" name="id" value={r.id} />
                    <button className="btn ghost" type="submit" style={{ color: 'var(--red)' }}>{t.revoke}</button></form>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form action={action} className="filters">
        <label className="field" style={{ flex: '1 1 240px' }}><span className="flabel">{t.name}</span>
          <input className="input" name="name" required minLength={2} maxLength={80} placeholder="App madre YouSud" /></label>
        <button className="btn primary" type="submit" disabled={busy} style={{ alignSelf: 'end' }}>{t.create}</button>
      </form>
    </div>
  );
}
