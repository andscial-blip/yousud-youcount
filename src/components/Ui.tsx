import type { ReactNode } from 'react';
import { I, type IconName } from '@/lib/icons';

// Elementi grafici approvati dal panel: icone, tipo di movimento, stato, giustificativo, paese, stati vuoti.

export function Ico({ name, size = 16, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined}
         aria-label={label} style={{ flex: 'none' }}>
      <path d={I[name]} />
    </svg>
  );
}

export type Kind = 'income' | 'expense' | 'transfer';
export function KindIcon({ kind, label, faded = false }: { kind: Kind; label: string; faded?: boolean }) {
  return (
    <span className={`kind kind-${kind}`} style={faded ? { opacity: 0.5 } : undefined}>
      <Ico name={kind} /><span className="sr-only">{label}</span>
    </span>
  );
}

const STATUS_ICON = { draft: 'draft', recorded: 'clock', verified: 'verified', reversed: 'reversed' } as const;
const STATUS_CLS = { draft: '', recorded: 'warn', verified: 'ok', reversed: 'err' } as const;
export function StatusChip({ s, label }: { s: keyof typeof STATUS_ICON; label: string }) {
  return <span className={`chip ichip ${STATUS_CLS[s]}`}><Ico name={STATUS_ICON[s]} size={14} />{label}</span>;
}

// Giustificativo: graffetta (presente, con numero se più di uno), documento con «!» (manca), documento con «–» (assenza dichiarata)
export function DocIndicator({ count, noDocReason, labels }: {
  count: number; noDocReason: string | null; labels: { has: string; missing: string; none: string };
}) {
  if (count > 0) return <span className="docind" title={labels.has}><Ico name="clip" />{count > 1 && <small>{count}</small>}<span className="sr-only">{labels.has}</span></span>;
  if (noDocReason) return <span className="docind" title={`${labels.none}: ${noDocReason}`}><Ico name="docNone" /><span className="sr-only">{labels.none}</span></span>;
  return <span className="docind miss" title={labels.missing}><Ico name="docMissing" /><span className="sr-only">{labels.missing}</span></span>;
}

export function Place({ loc, label }: { loc: 'IT' | 'MG' | string; label: string }) {
  return <span className={`place ${loc === 'IT' ? 'it' : 'mg'}`} title={label}>{loc}</span>;
}

// Stato vuoto: piccola ricevuta a mosaico in toni pastello, con distintivo, titolo e azione
export function EmptyState({ title, text, action, badge = 'plus' }: { title: string; text?: string; action?: ReactNode; badge?: IconName }) {
  return (
    <div className="empty">
      <svg className="empty-art" viewBox="0 0 80 80" aria-hidden="true">
        <path d="M18 6h44v62l-7.3-5-7.4 5-7.3-5-7.3 5-7.4-5L18 68z" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M20 8h20l-6 20H20z" fill="#D3EEE6" /><path d="M42 8h18v16l-22 4z" fill="#E4DEF4" />
        <path d="M20 30h14l6 18H20z" fill="#FBEFC9" /><path d="M36 30l24-4v20H42z" fill="#DCEBCF" />
        <path d="M20 50h20l-6 14-7-4.8-7 4.8z" fill="#D6E6F5" /><path d="M42 48h18v16l-5.3-3.6-7.4 5-7.3-5z" fill="#F5D7E1" />
        <circle cx="58" cy="58" r="13" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.5" />
        <g transform="translate(50 50) scale(.667)" fill="none" stroke="var(--slate-2)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d={I[badge]} />
        </g>
      </svg>
      <div className="empty-t">{title}</div>
      {text && <p className="muted" style={{ margin: 0, fontSize: 13 }}>{text}</p>}
      {action}
    </div>
  );
}
