import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { date, money } from '@/lib/format';
import { DOC_TYPES } from '@/lib/doc-model';
import { ErrorNote, PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

type Row = { id: string; href: string; type: string; number: string | null; date: string; party: string | null; amount: string | null; currency: string;
  status: 'draft' | 'issued' | 'cancelled' | 'tosign' | 'signed'; movement?: string | null };

// Documenti emessi da YouSud: autocertificazioni (dal movimento), ricevute, quietanze, notule, note spese,
// autorizzazioni di spesa, note di debito. Numerazione per tipo e anno; gli annullati restano in elenco.
export default async function IssuedDocs({ searchParams }: { searchParams: Promise<{ tipo?: string; anno?: string; ok?: string }> }) {
  const sp = await searchParams;
  const { supabase, t, lang } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const year = Number(sp.anno) || new Date().getFullYear();
  const tipo = sp.tipo ?? '';
  const [{ data: docs, error }, { data: auts }] = await Promise.all([
    supabase.from('issued_docs').select('id, type, number, status, doc_date, party_name, amount, currency, movement:movements(id, ref)')
      .gte('doc_date', `${year}-01-01`).lte('doc_date', `${year}-12-31`).order('doc_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('self_certs').select('id, number, exp_date, declarant, amount, currency, signed_at, document_id, movement_id, movement:movements(ref)')
      .gte('exp_date', `${year}-01-01`).lte('exp_date', `${year}-12-31`).order('exp_date', { ascending: false }),
  ]);
  type D = { id: string; type: string; number: string | null; status: Row['status']; doc_date: string; party_name: string | null; amount: string | null; currency: string; movement: { id: string; ref: string | null } | null };
  type A = { id: string; number: string; exp_date: string; declarant: string; amount: string; currency: string; signed_at: string | null; document_id: string | null; movement_id: string; movement: { ref: string | null } | null };
  const rows: Row[] = [
    ...((docs ?? []) as unknown as D[]).map((d) => ({ id: d.id, href: `/documenti-emessi/${d.id}`, type: d.type, number: d.number, date: d.doc_date, party: d.party_name,
      amount: d.amount, currency: d.currency, status: d.status, movement: d.movement?.ref })),
    ...((auts ?? []) as unknown as A[]).filter((a) => a.document_id).map((a) => ({ id: a.id, href: `/movimenti/${a.movement_id}`, type: 'AUT', number: a.number, date: a.exp_date,
      party: a.declarant, amount: a.amount, currency: a.currency, status: (a.signed_at ? 'signed' : 'tosign') as Row['status'], movement: a.movement?.ref })),
  ].filter((r) => !tipo || r.type === tipo).sort((a, b) => b.date.localeCompare(a.date) || String(b.number).localeCompare(String(a.number)));
  const name = (k: string) => (k === 'AUT' ? L('Autocertificazione', 'Attestation') : L(DOC_TYPES[k as keyof typeof DOC_TYPES].it, DOC_TYPES[k as keyof typeof DOC_TYPES].fr));
  const chip = (s: Row['status']) => ({ draft: <span className="chip warn">{L('Bozza', 'Brouillon')}</span>, issued: <span className="chip ok">{L('Emesso', 'Émis')}</span>,
    cancelled: <span className="chip bad">{L('Annullato', 'Annulé')}</span>, tosign: <span className="chip warn">{L('Da firmare', 'À signer')}</span>,
    signed: <span className="chip ok">{L('Firmata', 'Signée')}</span> })[s];
  const q = (o: Record<string, string | number>) => `/documenti-emessi?${new URLSearchParams({ anno: String(year), ...(tipo ? { tipo } : {}), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) })}`;
  return (
    <div className="stack">
      <PageHead title={L('Documenti emessi', 'Documents émis')}>
        <div className="seg" role="group" aria-label={L('Anno', 'Année')}>
          <Link href={q({ anno: year - 1 })}>← {year - 1}</Link><Link href={q({ anno: year + 1 })}>{year + 1} →</Link>
        </div>
      </PageHead>
      {sp.ok === 'deleted' && <div className="note ok" role="status">{L('Bozza eliminata.', 'Brouillon supprimé.')}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel title={L('Nuovo documento', 'Nouveau document')} pad>
        <div className="typecards">
          {(Object.keys(DOC_TYPES) as (keyof typeof DOC_TYPES)[]).map((k) => (
            <Link key={k} href={`/documenti-emessi/nuovo?tipo=${k}`}><b>{L(DOC_TYPES[k].it, DOC_TYPES[k].fr)}</b><small>{L(...DOC_TYPES[k].what)}</small></Link>
          ))}
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>{L(
          'L\'autocertificazione di spesa si genera dal dettaglio della spesa senza scontrino. Le fatture non si generano qui: chi ha partita IVA le emette elettroniche tramite il Sistema di Interscambio (con il commercialista o un software certificato); un\'ODV senza partita IVA non emette fatture e per le somme istituzionali usa la nota di debito.',
          'L\'attestation de dépense se génère depuis le détail de la dépense sans ticket. Les factures ne se génèrent pas ici : en Italie, qui a un numéro de TVA les émet électroniques via le Système d\'échange (avec le comptable ou un logiciel certifié) ; une ODV sans numéro de TVA n\'émet pas de factures et utilise la note de débit pour les sommes institutionnelles.')}</p>
      </Panel>
      <nav className="quick" aria-label={L('Tipo', 'Type')}>
        <Link href={q({ tipo: '' })} aria-current={!tipo ? 'true' : undefined}>{L('Tutti', 'Tous')}</Link>
        {['AUT', ...Object.keys(DOC_TYPES)].map((k) => <Link key={k} href={q({ tipo: k })} aria-current={tipo === k ? 'true' : undefined}>{name(k)}</Link>)}
      </nav>
      <Panel>
        {rows.length === 0 ? <div className="panel-b muted">{L('Nessun documento nell\'anno.', 'Aucun document dans l\'année.')}</div> : (
          <table className="t">
            <thead><tr><th>{L('Numero', 'Numéro')}</th><th>{L('Tipo', 'Type')}</th><th>{L('Data', 'Date')}</th><th>{L('Controparte', 'Contrepartie')}</th>
              <th className="r">{L('Importo', 'Montant')}</th><th>{L('Movimento', 'Mouvement')}</th><th>{L('Stato', 'Statut')}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.type}-${r.id}`} className={r.status === 'cancelled' ? 'muted' : ''}>
                  <td className="nw"><Link className="rowlink" href={r.href}>{r.number ?? L('(bozza)', '(brouillon)')}</Link></td>
                  <td>{name(r.type)}</td><td className="num">{date(r.date)}</td><td>{r.party ?? '–'}</td>
                  <td className="r num">{r.amount ? money(r.amount, r.currency, lang) : ''}</td><td className="muted">{r.movement ?? ''}</td><td>{chip(r.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
