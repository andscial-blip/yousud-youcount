import type { Model } from '@/lib/doc-model';

// Anteprima del documento com'è nel PDF: stesso modello, stessi testi.
export function DocPreview({ md }: { md: Model }) {
  return (
    <article className="docprev" aria-label={md.title}>
      <header className={md.org.logo ? 'has-logo' : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element -- immagine incorporata (data URL) */}
        {md.org.logo && <img className="dp-logo" src={`data:${md.org.logo.mime};base64,${md.org.logo.data}`} alt="" />}
        <b className="dp-org">{md.org.name}</b>
        {(md.org.address || md.org.tax_id) && <small>{[md.org.address, md.org.tax_id ? `C.F. ${md.org.tax_id}` : null].filter(Boolean).join(' · ')}</small>}
      </header>
      <h3>{md.title}</h3>
      <p className="dp-meta">{md.meta.map(([k, v]) => `${k} ${v}`).join('  ·  ')}</p>
      {!md.number && <p className="dp-draft">{md.draftLabel}</p>}
      {md.blocks.map((b, i) => b.k === 'p' ? <p key={i} className={b.soft ? 'soft' : ''}>{b.text}</p>
        : b.k === 'table' ? (
          <table key={i}><thead><tr>{b.head.map((h, j) => <th key={j} className={b.num.includes(j) ? 'r' : ''}>{h}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} className={b.num.includes(k) ? 'r num' : ''}>{c}</td>)}</tr>)}</tbody></table>
        ) : b.k === 'totals' ? (
          <dl key={i} className="dp-tot">{b.rows.map(([k, v, s], j) => <div key={j} className={s ? 'strong' : ''}><dt>{k}</dt><dd className="num">{v}</dd></div>)}</dl>
        ) : (
          <div key={i} className="dp-sig"><p className="soft">{md.placeDate}: ______________________</p>
            <div>{b.labels.map((l, j) => <span key={j}>{l}</span>)}</div></div>
        ))}
    </article>
  );
}
