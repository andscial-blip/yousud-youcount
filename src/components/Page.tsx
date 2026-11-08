import Link from 'next/link';
import { Ico } from './Ui';
import type { ReactNode } from 'react';

export function PageHead({ title, lead, children }: { title: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="h1row">
      {lead}
      <h1>{title}</h1>
      <div className="spacer" />
      {children}
    </div>
  );
}

export function Panel({ title, children, pad = false }: { title?: string; children: ReactNode; pad?: boolean }) {
  return (
    <section className="panel" style={{ overflowX: 'auto' }}>
      {title && <div className="panel-h"><h2>{title}</h2></div>}
      {pad ? <div className="panel-b">{children}</div> : children}
    </section>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="panel-b muted">{text}</div>;
}

export function Denied({ text }: { text: string }) {
  return <div className="note">{text}</div>;
}

export function ErrorNote({ prefix, error }: { prefix: string; error: { message: string } | null | undefined }) {
  return error ? <div className="note err">{prefix}: {error.message}</div> : null;
}

// Ricerca in un elenco: modulo GET, il termine resta nell'indirizzo; «Annulla ricerca» torna all'elenco completo
export function SearchBox({ action, value, placeholder, clearLabel, hidden = {} }: {
  action: string; value: string; placeholder: string; clearLabel: string; hidden?: Record<string, string>;
}) {
  const keep = Object.entries(hidden).filter(([, v]) => v);
  const clear = keep.length ? `${action}?${new URLSearchParams(keep).toString()}` : action;
  return (
    <form className="search" method="get" action={action} role="search">
      {keep.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Ico name="search" />
      <input className="input" type="search" name="q" defaultValue={value} placeholder={placeholder} aria-label={placeholder} />
      {value && <Link className="btn ghost" href={clear}>{clearLabel}</Link>}
    </form>
  );
}
