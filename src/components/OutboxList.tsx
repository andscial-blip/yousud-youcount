'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Dict } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import { deleteOutbox, flushOutbox, listOutbox, OUTBOX_EVENT, type OutItem } from '@/lib/outbox';

const fmt = (n: number, cur: string) => new Intl.NumberFormat('it-IT', {
  style: 'currency', currency: cur, maximumFractionDigits: cur === 'MGA' ? 0 : 2, minimumFractionDigits: cur === 'MGA' ? 0 : 2,
}).format(n);
const day = (d: string) => d.split('-').reverse().join('/');

// Movimenti salvati sul telefono e non ancora ricevuti dal server.
export function OutboxList({ t }: { t: Dict }) {
  const [items, setItems] = useState<OutItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  useEffect(() => {
    const load = () => listOutbox().then(setItems).catch(() => setItems([]));
    load();
    window.addEventListener(OUTBOX_EVENT, load);
    return () => window.removeEventListener(OUTBOX_EVENT, load);
  }, []);

  if (items === null) return null;
  return (
    <section className="panel">
      <div className="panel-h"><h2>{t.q_title}</h2>
        {items.length > 0 && (
          <button className="btn primary" disabled={busy} style={{ marginLeft: 'auto' }} onClick={async () => {
            setBusy(true);
            const r = await flushOutbox(supabase, { retryErrors: true }).catch(() => ({ sent: 0, failed: 0 }));
            setBusy(false);
            if (r.sent) router.refresh();
          }}>{busy ? t.q_sending : t.q_send}</button>
        )}
      </div>
      {items.length === 0 ? <div className="panel-b muted">{t.q_empty}</div> : (
        <ul className="qlist">
          {items.map((it) => (
            <li key={it.id}>
              <div className="q-main">
                <b>{it.label}</b>
                <span className="muted">{day(it.opDate)}{it.files.length ? ` · ${it.files.length} ${t.q_files}` : ''}</span>
                {it.state === 'error' && it.error && <span className="ferr">{it.error}</span>}
              </div>
              <span className="num nw">{fmt(it.amount, it.currency)}</span>
              <span className={`chip ${it.state === 'error' ? 'err' : 'warn'}`}>{it.state === 'error' ? t.q_err : t.q_wait}</span>
              {it.state === 'error' && (
                <button className="btn ghost" onClick={async () => { if (window.confirm(t.q_delete_confirm)) await deleteOutbox(it.id); }}>{t.q_delete}</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
