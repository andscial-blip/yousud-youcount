'use client';
// Campo importo per i moduli semplici (anticipi, scadenze, finanziamenti): stessa scrittura guidata del nuovo
// movimento (punto delle migliaia, virgola dei decimali) e sotto il campo l'importo letto, per esteso.
import { useState } from 'react';
import { formatTyping, parseAmount } from '@/lib/amount';

type Props = { id: string; name: string; lang: 'it' | 'fr'; currency?: string; defaultValue?: string; required?: boolean; label?: string; ariaLabel?: string };

export default function AmountField({ id, name, lang, currency, defaultValue = '', required, ariaLabel }: Props) {
  const [txt, setTxt] = useState(defaultValue ? formatTyping(defaultValue).text : '');
  const n = parseAmount(txt);
  const loc = lang === 'fr' ? 'fr-FR' : 'it-IT';
  const shown = n === null ? '' : `${n.toLocaleString(loc, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2, useGrouping: 'always' } as Intl.NumberFormatOptions)}${currency ? ` ${currency === 'EUR' ? '€' : currency}` : ''}`;
  return (<>
    <input className="input num" id={id} name={name} inputMode="decimal" autoComplete="off" required={required} aria-label={ariaLabel}
           placeholder="0" value={txt}
           onChange={(e) => { const el = e.target; const r = formatTyping(el.value, el.selectionStart ?? el.value.length); setTxt(r.text);
             requestAnimationFrame(() => { try { el.setSelectionRange(r.caret, r.caret); } catch { /* niente */ } }); }} />
    {shown && <span className="hint amt-echo">{lang === 'fr' ? 'Montant lu' : 'Importo letto'}: <b>{shown}</b></span>}
  </>);
}
