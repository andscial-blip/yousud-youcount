import type { ReactNode } from 'react';
import { Ico } from './Ui';

// Righe modificabili delle pagine di amministrazione: si tocca la riga, si apre il modulo.
// Nessuna cancellazione: i dati di riferimento si disattivano.

export function Flash({ ok, err, okText }: { ok?: string; err?: string; okText: string }) {
  if (ok) return <div className="note ok" role="status"><Ico name="check" />{okText}</div>;
  if (err) return <div className="note err" role="alert">{err}</div>;
  return null;
}

export function EditRow({ summary, children, inactive, open }: { summary: ReactNode; children: ReactNode; inactive?: boolean; open?: boolean }) {
  return (
    <details className={`erow${inactive ? ' off' : ''}`} open={open}>
      <summary><span className="erow-s">{summary}</span><Ico name="edit" /></summary>
      <div className="erow-b">{children}</div>
    </details>
  );
}

export function F({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`field${wide ? ' span2' : ''}`}><span className="flabel">{label}</span>{children}</label>;
}

export function Hidden({ v }: { v: Record<string, string> }) {
  return <>{Object.entries(v).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}</>;
}

export function SaveBar({ label, extra }: { label: string; extra?: ReactNode }) {
  return (
    <div className="span2" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <button className="btn primary" type="submit"><Ico name="check" />{label}</button>{extra}
    </div>
  );
}
