'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { saveDashNotes } from '@/app/(app)/notes-action';

// Note libere della Dashboard, condivise nell'ente: si scrivono qui e si salvano con il pulsante.
// Barra dei simboli come in Cairn: simboli nel colore del testo (niente emoji a colori), ☐ per le caselle da
// spuntare, i 7 usati più di recente e «+» per il pannello completo per tema.
const SYM_G: [string, string, string[]][] = [
  ['Stato', 'État', ['✓', '✔︎', '✗', '★', '☆', '⚑', '⚐', '⚠︎', '‼︎', '⁇︎', '●', '○', '◆', '◇', '■', '□', '▲', '▼']],
  ['Frecce', 'Flèches', ['→', '←', '↑', '↓', '↔', '⇒', '↩︎', '↻', '➜', '⤴︎']],
  ['Lavoro e tempo', 'Travail et temps', ['✎', '✍︎', '✉︎', '☎︎', '✂︎', '⌚︎', '⌛︎', '⏱︎', '⚙︎', '⚖︎', '☰', '⌘']],
  ['Soldi e numeri', 'Argent et nombres', ['€', '$', '£', '%', '+', '−', '×', '÷', '≈', '≠', '∑', '№']],
  ['Luoghi e viaggi', 'Lieux et voyages', ['✈︎', '⚓︎', '⌂', '☀︎', '☁︎', '☂︎', '❄︎', '⛰︎', '⛺︎', '⌖']],
  ['Vita', 'Vie', ['♥︎', '☺︎', '☹︎', '♫', '☕︎', '✿', '☘︎', '♻︎', '⚽︎', '⚕︎']],
];
const REC_K = 'yc-note-syms';
const DEF = ['✓', '★', '⚑', '⚠︎', '€', '☎︎', '✉︎'];
const BOX = /^([ \t]*)\[( |x|X)?\] /gm;

export function DashNotes({ text, meta, canWrite, lang }: { text: string; meta: string; canWrite: boolean; lang: 'it' | 'fr' }) {
  const FR = lang === 'fr';
  const L = (it: string, fr: string) => (FR ? fr : it);
  const [val, setVal] = useState(text);
  const [rec, setRec] = useState<string[]>(DEF);
  const [open, setOpen] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const sel = useRef<[number, number] | null>(null);
  const [state, act, pending] = useActionState(saveDashNotes, { ok: false, err: '', meta });

  useEffect(() => { try { const r = JSON.parse(localStorage.getItem(REC_K) ?? 'null'); if (Array.isArray(r) && r.length) setRec(r.slice(0, 7)); } catch { /* niente */ } }, []);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('click', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const keep = () => { const t = ta.current; if (t) sel.current = [t.selectionStart, t.selectionEnd]; };
  const commit = (v: string, caret: number) => { setVal(v); requestAnimationFrame(() => { const t = ta.current; if (t) { t.focus(); t.setSelectionRange(caret, caret); keep(); } }); };

  const ins = (c: string) => {
    const t = ta.current; if (!t) return;
    const [a, b] = sel.current ?? [t.value.length, t.value.length];
    const v = t.value;
    if (c === '☐') {
      const ls = v.lastIndexOf('\n', a - 1) + 1;
      if (/^[ \t]*[☐☑]/.test(v.slice(ls))) return commit(v, a);
      return commit(v.slice(0, ls) + '☐ ' + v.slice(ls), a + 2);
    }
    const prev = v[a - 1];
    const s = (prev && !/\s/.test(prev) ? ' ' : '') + c + ' ';
    const nr = [c, ...rec.filter((x) => x !== c)].slice(0, 7);
    setRec(nr); try { localStorage.setItem(REC_K, JSON.stringify(nr)); } catch { /* niente */ }
    commit(v.slice(0, a) + s + v.slice(b), a + s.length);
  };

  // «[ ] » o «[x] » a inizio riga diventano ☐ / ☑
  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const t = e.target; let v = t.value; const p = t.selectionStart;
    if (BOX.test(v)) {
      BOX.lastIndex = 0;
      const conv = (s: string) => s.replace(BOX, (_m, ws: string, x?: string) => ws + (x && x.trim() ? '☑ ' : '☐ '));
      const nb = conv(v.slice(0, p)); v = nb + conv(v.slice(p)); BOX.lastIndex = 0;
      return commit(v, nb.length);
    }
    setVal(v); keep();
  };
  // un tocco sulla casella la spunta o la toglie
  const onClick = () => {
    keep(); const t = ta.current; if (!t || !canWrite || t.selectionStart !== t.selectionEnd) return;
    const v = t.value, p = t.selectionStart, ls = v.lastIndexOf('\n', p - 1) + 1, ws = (/^[ \t]*/.exec(v.slice(ls)) ?? [''])[0].length, b = ls + ws, ch = v[b];
    if ((ch === '☐' || ch === '☑') && (p === b || p === b + 1)) commit(v.slice(0, b) + (ch === '☐' ? '☑' : '☐') + v.slice(b + 1), b + 2);
  };
  // Invio continua l'elenco di caselle
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    const t = e.currentTarget, v = t.value, p = t.selectionStart, ls = v.lastIndexOf('\n', p - 1) + 1, line = v.slice(ls, p), m = /^([ \t]*)[☐☑] ?/.exec(line);
    if (!m) return;
    e.preventDefault();
    if (line.trim() === '☐' || line.trim() === '☑') return commit(v.slice(0, ls) + v.slice(p), ls);
    const s = '\n' + m[1] + '☐ ';
    commit(v.slice(0, p) + s + v.slice(t.selectionEnd), p + s.length);
  };

  const B = ({ c, title }: { c: string; title?: string }) => (
    <button type="button" data-sym={c} title={title ?? L(`Inserisci ${c}`, `Insérer ${c}`)} aria-label={title ?? L(`Inserisci ${c}`, `Insérer ${c}`)}
      onPointerDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); ins(c); }}>{c}</button>
  );

  return (
    <form action={act} className="dnotes">
      {canWrite && (
        <div className="note-bar">
          <B c="☐" title={L('Casella da spuntare', 'Case à cocher')} />
          {rec.map((c) => <B key={c} c={c} />)}
          <button type="button" className="nb-more" aria-expanded={open} aria-label={L('Altri simboli', 'Autres symboles')} title={L('Altri simboli', 'Autres symboles')}
            onPointerDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>+</button>
          {open && (
            <div className="nb-pop" role="dialog" aria-label={L('Simboli', 'Symboles')} onClick={(e) => e.stopPropagation()}>
              {SYM_G.map(([it, fr, g]) => (
                <div key={it}><div className="nb-g">{L(it, fr)}</div><div className="nb-row">{g.map((c) => <B key={c} c={c} />)}</div></div>
              ))}
            </div>
          )}
        </div>
      )}
      <textarea ref={ta} className="input" name="text" rows={5} maxLength={4000} value={val} readOnly={!canWrite}
        onChange={onChange} onClick={onClick} onKeyUp={keep} onSelect={keep} onKeyDown={onKey} aria-label={L('Note', 'Notes')}
        placeholder={canWrite ? L('Promemoria per il gruppo: cose da ricordare, accordi, numeri utili… Scrivi [ ] per una casella da spuntare.', 'Mémo pour l\'équipe : choses à retenir, accords, numéros utiles… Tapez [ ] pour une case à cocher.') : ''} />
      <div className="dn-f">
        <small className="muted">{state.err ? <span className="neg">{state.err}</span> : state.meta}</small>
        {canWrite && <button className="btn small" type="submit" disabled={pending}>
          {pending ? L('Salvataggio…', 'Enregistrement…') : L('Salva', 'Enregistrer')}</button>}
      </div>
    </form>
  );
}
