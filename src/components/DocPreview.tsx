import type { Cell, Model } from '@/lib/doc-model';

// Importo in due valute: € grande, MGA piccolo sotto
function Amt({ c }: { c: Cell }) {
  if (typeof c === 'string') return <>{c}</>;
  return <span className="dp-two"><b>{c[0]}</b><small>{c[1]}</small></span>;
}

// Anteprima del documento com'è nel PDF: stesso modello, stessi testi.
export function DocPreview({ md }: { md: Model }) {
  return (
    <article className="docprev" aria-label={md.title}>
      <header className={md.org.logo ? 'has-logo' : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element -- immagine incorporata (data URL) */}
        {md.org.logo && <img className="dp-logo" src={`data:${md.org.logo.mime};base64,${md.org.logo.data}`} alt="" />}
        <b className="dp-org">{md.org.name}</b>
        {md.orgLine && <small>{md.orgLine}</small>}
      </header>
      <h3>{md.title}</h3>
      <p className="dp-meta">{md.meta.map(([k, v]) => `${k} ${v}`).join('  ·  ')}</p>
      {!md.number && <p className="dp-draft">{md.draftLabel}</p>}
      {md.blocks.map((b, i) => b.k === 'p' ? <p key={i} className={b.soft ? 'soft' : ''}>{b.text}</p>
        : b.k === 'table' ? (
          <div key={i} className="dp-tw">
            <table><thead><tr>{b.head.map((h, j) => <th key={j} className={b.num.includes(j) ? 'r' : ''}>{h}</th>)}</tr></thead>
              <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} className={b.num.includes(k) ? 'r num' : ''}><Amt c={c} /></td>)}</tr>)}</tbody></table>
          </div>
        ) : b.k === 'totals' ? (
          <dl key={i} className="dp-tot">{b.rows.map(([k, v, s], j) => <div key={j} className={s ? 'strong' : ''}><dt>{k}</dt><dd className="num"><Amt c={v} /></dd></div>)}</dl>
        ) : (
          <div key={i} className="dp-sig"><p className="soft">{md.placeDate}: ______________________</p>
            <div>{b.labels.map((l, j) => <span key={j}>{l}</span>)}</div></div>
        ))}
      {md.fxNote && <p className="dp-fx soft">{md.fxNote}</p>}
      {md.footer && <footer className="dp-foot">{md.footer}</footer>}
    </article>
  );
}
