'use client';
// Cornice dell'app come Cairn (src/components/shell.tsx): menu laterale; intestazione con icona della sezione, titolo,
// sottotitolo, Cerca, anno e «Nuovo movimento»; sotto-schede. Tablet: colonna di icone. Telefono: barra in alto e in basso.
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CIcon } from './CIcon';
import { YEAR_PATHS } from '@/lib/nav';

export type NavSub = { href: string; label: string };
export type NavSec = { id: string; label: string; hint: string; ic: string; subs: NavSub[]; also?: string[] };

export function locateNav(secs: NavSec[], path: string) {
  let best: { sec: NavSec; sub: NavSub | null; len: number } | null = null;
  for (const sec of secs) {
    for (const sub of sec.subs) {
      const hit = sub.href === '/' ? path === '/' : path === sub.href || path.startsWith(sub.href + '/');
      if (hit && (!best || sub.href.length > best.len)) best = { sec, sub, len: sub.href.length };
    }
    for (const a of sec.also ?? []) if (!best && (path === a || path.startsWith(a + '/'))) best = { sec, sub: null, len: a.length };
  }
  return best ? { sec: best.sec, sub: best.sub } : { sec: null, sub: null };
}

export function SideNav({ secs, label }: { secs: NavSec[]; label: string }) {
  const path = usePathname();
  const active = locateNav(secs, path).sec?.id;
  return (
    <nav className="side-nav" aria-label={label}>
      {secs.map((s) => (
        <Link key={s.id} href={s.subs[0]!.href} className="side-link" aria-current={active === s.id ? 'page' : undefined} title={s.label}>
          <CIcon name={s.ic} size={18} /><span>{s.label}</span>
        </Link>
      ))}
    </nav>
  );
}

type HeadLabels = { search: string; year: string; newMov: string; subnav: string; brand: string; cmdPh: string; searchMov: string; goTo: string; none: string };

export function PageHeader({ secs, labels, canWrite, years, phoneBrand, phoneSync }: {
  secs: NavSec[]; labels: HeadLabels; canWrite: boolean; years: number[];
  phoneBrand: React.ReactNode; phoneSync: React.ReactNode;
}) {
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const { sec } = locateNav(secs, path);
  const [cmd, setCmd] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd(true); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const year = Number(sp.get('anno')) || new Date().getFullYear();
  const setYear = (y: number) => {
    const q = new URLSearchParams(sp.toString()); q.set('anno', String(y));
    router.push(`${path}?${q.toString()}`);
  };
  const showYear = YEAR_PATHS.includes(path);
  const ys = years.includes(year) ? years : [...years, year].sort((a, b) => b - a);
  return (
    <header className="phead">
      <div className="phead-row">
        <Link href="/" className="pbrand only-phone" aria-label={labels.brand}>{phoneBrand}</Link>
        {sec && <span className="picon not-phone" aria-hidden="true"><CIcon name={sec.ic} size={22} /></span>}
        <div className="ptitle"><h1>{sec?.label ?? labels.brand}</h1>{sec?.hint && <p>{sec.hint}</p>}</div>
        <div className="pctl">
          <span className="only-phone">{phoneSync}</span>
          <button type="button" className="btn ghost searchbtn" onClick={() => setCmd(true)} aria-label={`${labels.search} (⌘K)`} title={`${labels.search} (⌘K)`}>
            <CIcon name="search" size={16} /><span className="not-phone">{labels.search}</span><kbd className="not-phone">⌘K</kbd>
          </button>
          {showYear && (
            <label className="yearsel"><span className="vh">{labels.year}</span>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label={labels.year}>
                {ys.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          )}
          {canWrite && <Link className="btn primary not-phone" href="/nuovo"><CIcon name="plus" size={16} />{labels.newMov}</Link>}
        </div>
      </div>
      {sec && sec.subs.length > 1 && (
        <nav className="subnav" aria-label={`${labels.subnav}: ${sec.label}`}>
          {sec.subs.map((x) => (
            <Link key={x.href} href={x.href}
                  aria-current={(x.href === '/' ? path === '/' : path === x.href || path.startsWith(x.href + '/')) ? 'page' : undefined}>{x.label}</Link>
          ))}
        </nav>
      )}
      {cmd && <CommandPalette secs={secs} onClose={() => setCmd(false)} labels={labels} />}
    </header>
  );
}

// Cerca (⌘K), come Cairn: vai a una sezione o cerca un testo nei movimenti.
function CommandPalette({ secs, onClose, labels }: { secs: NavSec[]; onClose: () => void; labels: HeadLabels }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const router = useRouter();
  const norm = (x: string) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const all = useMemo(() => secs.flatMap((s) => s.subs.map((x) => ({ href: x.href, label: x.label, sub: s.label === x.label ? s.hint : s.label, ic: s.ic, group: labels.goTo }))), [secs, labels.goTo]);
  const t = norm(q.trim());
  const shown = [
    ...(t ? [{ href: `/movimenti?q=${encodeURIComponent(q.trim())}`, label: labels.searchMov.replace('{q}', q.trim()), sub: '', ic: 'search', group: labels.search }] : []),
    ...all.filter((i) => !t || t.split(/\s+/).every((w) => norm(`${i.label} ${i.sub}`).includes(w))),
  ].slice(0, 30);
  useEffect(() => { setSel(0); }, [q]);
  const run = (i?: (typeof shown)[number]) => { if (!i) return; onClose(); router.push(i.href); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((v) => Math.min(shown.length - 1, v + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((v) => Math.max(0, v - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(shown[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };
  let last = '';
  return (
    <div className="cmdk-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label={labels.search} onKeyDown={onKey}>
        <div className="cmdk-in">
          <CIcon name="search" size={18} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.cmdPh} aria-label={labels.search}
                 role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-activedescendant={shown[sel] ? `cmdk-${sel}` : undefined} />
          <kbd>esc</kbd>
        </div>
        <ul className="cmdk-list" id="cmdk-list" role="listbox">
          {shown.length === 0 && <li className="cmdk-empty">{labels.none}</li>}
          {shown.map((i, n) => {
            const head = i.group !== last ? (last = i.group, <li className="cmdk-g" role="presentation" key={'g' + i.group}>{i.group}</li>) : null;
            return [head, (
              <li key={i.href + n} id={`cmdk-${n}`} role="option" aria-selected={n === sel} className="cmdk-it" onMouseMove={() => setSel(n)} onClick={() => run(i)}>
                <CIcon name={i.ic} size={16} /><span><b>{i.label}</b>{i.sub && <small>{i.sub}</small>}</span>
              </li>)];
          })}
        </ul>
      </div>
    </div>
  );
}

// Telefono: Dashboard, Movimenti, «+» al centro, Tesoreria, Altro (le altre sezioni in un foglio).
export function BottomNav({ secs, labels, canWrite }: { secs: NavSec[]; labels: { more: string; newMov: string; other: string; close: string; signOut: React.ReactNode }; canWrite: boolean }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  useEffect(() => { setMore(false); }, [path]);
  if (path.startsWith('/nuovo') || path.endsWith('/modifica')) return null;
  const active = locateNav(secs, path).sec?.id;
  const MAIN = ['home', 'mov', 'cassa'];
  const tab = (id: string) => {
    const s = secs.find((x) => x.id === id);
    if (!s) return <span key={id} />;
    return <Link key={id} href={s.subs[0]!.href} aria-current={active === id ? 'page' : undefined}><CIcon name={s.ic} size={20} /><span>{s.label}</span></Link>;
  };
  const others = secs.filter((s) => !MAIN.includes(s.id));
  return (
    <>
      <nav className="bnav" aria-label={labels.other}>
        {tab('home')}{tab('mov')}
        {canWrite ? <Link className="bplus" href="/nuovo" aria-label={labels.newMov}><CIcon name="plus" size={22} /></Link> : <span />}
        {tab('cassa')}
        <button type="button" aria-current={others.some((s) => s.id === active) ? 'page' : undefined} aria-expanded={more} onClick={() => setMore(true)}>
          <CIcon name="more" size={20} /><span>{labels.more}</span>
        </button>
      </nav>
      {more && (
        <div className="sheet-bg" onClick={(e) => { if (e.target === e.currentTarget) setMore(false); }}>
          <div className="sheet sheet-menu" role="dialog" aria-modal="true" aria-label={labels.other}>
            <div className="sheet-h"><h2>{labels.other}</h2><div className="spacer" /><button className="btn ghost" type="button" onClick={() => setMore(false)}>{labels.close}</button></div>
            <div className="sheet-b">
              <ul className="menu-list">
                {others.map((s) => (<li key={s.id}><Link href={s.subs[0]!.href}><CIcon name={s.ic} size={20} /><span><b>{s.label}</b><small>{s.hint}</small></span></Link></li>))}
                <li>{labels.signOut}</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
