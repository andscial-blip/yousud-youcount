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
