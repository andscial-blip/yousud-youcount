'use client';
import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';

/** Pulsante di invio che mostra l'attesa: su telefono, senza questo, un tocco su «Emetti» non dava alcun segno per alcuni secondi. */
export function PendingButton({ children, busy, className = 'btn primary', style }: { children: ReactNode; busy: string; className?: string; style?: React.CSSProperties }) {
  const { pending } = useFormStatus();
  return <button className={className} type="submit" disabled={pending} aria-busy={pending} style={style}>{pending ? busy : children}</button>;
}
