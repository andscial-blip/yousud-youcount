'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CIcon } from './CIcon';
import type { HelpEntry } from '@/lib/help';

// Pulsante (i) nell'intestazione di ogni scheda: apre la spiegazione di come funziona la scheda.
// I testi della guida si caricano solo al primo clic (non pesano sull'apertura delle pagine).
// Il pannello va in document.body: dentro l'intestazione (che ha backdrop-filter) un elemento fixed resterebbe chiuso nell'intestazione.
export function InfoButton({ path, lang }: { path: string; lang: 'it' | 'fr' }) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState<HelpEntry | null | undefined>(undefined);
  useEffect(() => { setH(undefined); }, [path]);
  useEffect(() => {
    if (!open || h !== undefined) return;
    import('@/lib/help').then((m) => setH(m.helpFor(path)));
  }, [open, h, path]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open]);
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const [title, paras] = h ? (lang === 'fr' ? h.fr : h.it) : ['', [] as string[]];
  return (
    <>
      <button type="button" className="btn ghost infobtn" onClick={() => setOpen(true)} aria-label={L('Come funziona questa scheda', 'Comment fonctionne cet onglet')}
              title={L('Come si fa', 'Mode d’emploi')}><CIcon name="info" size={17} /><span className="ib-l">{L('Come si fa', 'Mode d’emploi')}</span></button>
      {open && typeof document !== 'undefined' && createPortal(
        <div className="sheet-bg" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="sheet sheet-help" role="dialog" aria-modal="true" aria-label={title || L('Guida', 'Guide')}>
            <div className="sheet-h"><h2>{h === undefined ? L('Guida', 'Guide') : title || L('Guida', 'Guide')}</h2><div className="spacer" />
              <button className="btn ghost" type="button" onClick={() => setOpen(false)}>{L('Chiudi', 'Fermer')}</button></div>
            <div className="sheet-b help-b">
              {h === undefined ? <p className="muted">…</p> : h === null ? <p>{L('Per questa pagina non c\'è ancora una spiegazione specifica.', 'Pas encore d\'explication pour cette page.')}</p>
                : paras.map((p, i) => <p key={i}>{p}</p>)}
              <p><Link href={`/guida${h ? `#${h.href.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home'}` : ''}`} onClick={() => setOpen(false)}>{L('Apri la guida completa', 'Ouvrir le guide complet')} →</Link></p>
            </div>
          </div>
        </div>, document.body,
      )}
    </>
  );
}
