import Link from 'next/link';
import { FilterBar } from '@/components/FilterBar';
import { requireMe } from '@/lib/session';
import { date, money } from '@/lib/format';
import { DOC_GROUPS, DOC_TYPES } from '@/lib/doc-model';
import { ErrorNote, PageHead, Panel } from '@/components/Page';

export const dynamic = 'force-dynamic';

type Status = 'draft' | 'issued' | 'cancelled' | 'tosign' | 'signed';
type Row = { id: string; href: string; type: string; number: string | null; date: string; party: string | null; amount: string | null; currency: string;
  eur: number | null; status: Status; archived: boolean; movement?: string | null; project?: string | null };

// Archivio dei documenti generati da YouCount (non modelli): sezioni per categoria, ricerca, stato, archiviati.
// Le autocertificazioni nascono dal movimento; tutto il resto da «Emetti nuovo documento».
export default async function IssuedDocs({ searchParams }: { searchParams: Promise<{ sez?: string; anno?: string; ok?: string; q?: string; stato?: string; arch?: string }> }) {
  const sp = await searchParams;
  const { supabase, t, lang, me } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const year = Number(sp.anno) || new Date().getFullYear();
  const sez = DOC_GROUPS.find((g) => g.k === sp.sez);
  const q = (sp.q ?? '').trim().toLowerCase().slice(0, 80);
  const stato = ['draft', 'issued', 'cancelled'].includes(sp.stato ?? '') ? sp.stato! : '';
  const arch = sp.arch === '1';
  const [{ data: docs, error }, { data: auts }] = await Promise.all([
    supabase.from('issued_docs').select('id, type, number, status, doc_date, party_name, amount, currency, data, archived_at, movement:movements(id, ref), project:projects(name)')
      .gte('doc_date', `${year}-01-01`).lte('doc_date', `${year}-12-31`).order('doc_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('self_certs').select('id, number, exp_date, declarant, amount, currency, amount_eur, signed_at, document_id, movement_id, movement:movements(ref)')
      .gte('exp_date', `${year}-01-01`).lte('exp_date', `${year}-12-31`).order('exp_date', { ascending: false }),
  ]);
  type D = { id: string; type: string; number: string | null; status: Status; doc_date: string; party_name: string | null; amount: string | null; currency: string;
    data: { fx_rate?: number } | null; archived_at: string | null; movement: { id: string; ref: string | null } | null; project: { name: string } | null };
  type A = { id: string; number: string; exp_date: string; declarant: string; amount: string; currency: string; amount_eur: string | null; signed_at: string | null;
    document_id: string | null; movement_id: string; movement: { ref: string | null } | null };
  const eurOf = (a: string | null, cur: string, fx?: number | null) => (a == null ? null : cur === 'EUR' ? Number(a) : fx ? Math.round((Number(a) / fx) * 100) / 100 : null);
  const all: Row[] = [
    ...((docs ?? []) as unknown as D[]).map((d) => ({ id: d.id, href: `/documenti-emessi/${d.id}`, type: d.type, number: d.number, date: d.doc_date, party: d.party_name,
      amount: d.amount, currency: d.currency, eur: eurOf(d.amount, d.currency, d.data?.fx_rate), status: d.status, archived: !!d.archived_at,
      movement: d.movement?.ref, project: d.project?.name })),
    ...((auts ?? []) as unknown as A[]).filter((a) => a.document_id).map((a) => ({ id: a.id, href: `/movimenti/${a.movement_id}`, type: 'AUT', number: a.number, date: a.exp_date,
      party: a.declarant, amount: a.amount, currency: a.currency, eur: a.currency === 'EUR' ? Number(a.amount) : a.amount_eur ? Number(a.amount_eur) : null,
      status: (a.signed_at ? 'signed' : 'tosign') as Status, archived: false, movement: a.movement?.ref })),
  ];
  const inSez = (r: Row) => !sez || sez.types.includes(r.type as never);
  const rows = all.filter((r) => inSez(r) && r.archived === arch
      && (!stato || r.status === stato || (stato === 'issued' && (r.status === 'signed' || r.status === 'tosign')))
      && (!q || [r.number, r.party, r.movement, r.project, name(r.type)].some((v) => v?.toLowerCase().includes(q))))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.number).localeCompare(String(a.number)));
  const count = (k?: string) => all.filter((r) => !r.archived && (!k || DOC_GROUPS.find((g) => g.k === k)!.types.includes(r.type as never))).length;
  function name(k: string) { return k === 'AUT' ? L('Autocertificazione', 'Attestation') : L(DOC_TYPES[k as keyof typeof DOC_TYPES].it, DOC_TYPES[k as keyof typeof DOC_TYPES].fr); }
  const chip = (s: Status) => ({ draft: <span className="chip warn">{L('Bozza', 'Brouillon')}</span>, issued: <span className="chip ok">{L('Emesso', 'Émis')}</span>,
    cancelled: <span className="chip bad">{L('Annullato', 'Annulé')}</span>, tosign: <span className="chip warn">{L('Da firmare', 'À signer')}</span>,
    signed: <span className="chip ok">{L('Firmata', 'Signée')}</span> })[s];
  const href = (o: Record<string, string | number | undefined>) => {
    const p = { anno: String(year), sez: sez?.k, q: sp.q, stato, arch: arch ? '1' : undefined, ...o };
    return `/documenti-emessi?${new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))}`;
  };
  const writer = me?.role !== 'read_only';
  const amt = (r: Row) => !r.amount ? '' : r.eur != null && r.currency !== 'EUR'
    ? <span className="two"><b>{money(r.eur, 'EUR', lang)}</b><small>{money(r.amount, r.currency, lang)}</small></span>
    : <span className="two"><b>{money(r.amount, r.currency, lang)}</b></span>;
  return (
    <div className="stack">
      <PageHead title={L('Documenti emessi', 'Documents émis')}>
        {writer && <Link className="btn primary" href="/documenti-emessi/nuovo">+ {L('Emetti', 'Émettre')}</Link>}
      </PageHead>
      {sp.ok === 'deleted' && <div className="note ok" role="status">{L('Bozza eliminata.', 'Brouillon supprimé.')}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />
      <nav className="quick" aria-label={L('Sezioni', 'Sections')}>
        <Link href={href({ sez: undefined })} aria-current={!sez ? 'true' : undefined}>{L('Tutti', 'Tous')} <span className="n">{count()}</span></Link>
        {DOC_GROUPS.map((g) => <Link key={g.k} href={href({ sez: g.k })} aria-current={sez?.k === g.k ? 'true' : undefined}>{L(g.it, g.fr)} <span className="n">{count(g.k)}</span></Link>)}
      </nav>
      <Panel>
        <FilterBar action="/documenti-emessi" lang={lang} hidden={{ anno: String(year), sez: sez?.k }}
          search={{ value: sp.q ?? '', placeholder: L('Cerca numero o controparte', 'Numéro ou contrepartie') }}
          active={(stato ? 1 : 0) + (arch ? 1 : 0)} reset={sp.q || stato || arch ? href({ q: undefined, stato: undefined, arch: undefined }) : null}>
          <label className="field"><span className="flabel">{L('Stato', 'Statut')}</span>
            <select className="input" name="stato" defaultValue={stato}>
              <option value="">{L('Tutti gli stati', 'Tous les statuts')}</option><option value="draft">{L('Bozze', 'Brouillons')}</option>
              <option value="issued">{L('Emessi', 'Émis')}</option><option value="cancelled">{L('Annullati', 'Annulés')}</option></select></label>
          <label className="check"><input type="checkbox" name="arch" value="1" defaultChecked={arch} /> {L('Mostra gli archiviati', 'Afficher les archivés')}</label>
        </FilterBar>
        {rows.length === 0 ? (
          <div className="empty">
            <p>{q || stato ? L('Nessun documento con questi filtri.', 'Aucun document avec ces filtres.') : L(`Nessun documento nel ${year}${sez ? ` in «${sez.it}»` : ''}.`, `Aucun document en ${year}${sez ? ` dans « ${sez.fr} »` : ''}.`)}</p>
            {writer && !arch && <Link className="btn" href="/documenti-emessi/nuovo">+ {L('Emetti nuovo documento', 'Émettre un nouveau document')}</Link>}
          </div>
        ) : (
          <table className="t" data-cards="">
            <thead><tr><th>{L('Numero', 'Numéro')}</th><th>{L('Tipo', 'Type')}</th><th>{L('Data', 'Date')}</th><th>{L('Controparte', 'Contrepartie')}</th>
              <th className="r">{L('Importo', 'Montant')}</th><th>{L('Collegato a', 'Lié à')}</th><th>{L('Stato', 'Statut')}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.type}-${r.id}`} className={r.status === 'cancelled' ? 'muted' : ''}>
                  <td className="nw" data-label={L('Numero', 'Numéro')}><Link className="rowlink" href={r.href}>{r.number ?? L('Bozza', 'Brouillon')}</Link></td>
                  <td data-label={L('Tipo', 'Type')}>{name(r.type)}</td><td className="num nw" data-label={L('Data', 'Date')}>{date(r.date)}</td>
                  <td data-label={L('Controparte', 'Contrepartie')}>{r.party ?? '–'}</td>
                  <td className="r num" data-label={L('Importo', 'Montant')}>{amt(r)}</td>
                  <td className="muted" data-label={L('Collegato a', 'Lié à')}>{[r.movement, r.project].filter(Boolean).join(' · ') || '–'}</td>
                  <td data-label={L('Stato', 'Statut')}>{chip(r.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="panel-f">
          <span className="muted">{rows.length} {L(rows.length === 1 ? 'documento' : 'documenti', rows.length === 1 ? 'document' : 'documents')}</span>
        </div>
      </Panel>
    </div>
  );
}
