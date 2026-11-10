import Link from 'next/link';
import { FilterBar } from '@/components/FilterBar';
import { requireMe } from '@/lib/session';
import { docName } from '@/lib/doc-name';
import { date, money } from '@/lib/format';
import { ErrorNote, PageHead, Panel } from '@/components/Page';
import { EmptyState, Ico } from '@/components/Ui';
import { DocsZip } from '@/components/DocsZip';
import { linkDocument } from './actions';
import type { IconName } from '@/lib/icons';

const TYPE_ICON: Record<string, IconName> = { invoice: 'invoice', receipt: 'receipt', till_receipt: 'receipt', self_cert: 'selfCert', bank_statement: 'invoice', contract: 'invoice', other: 'invoice' };

export const dynamic = 'force-dynamic';

type Doc = { id: string; doc_type: string; doc_date: string | null; doc_number: string | null; total: string | null;
             currency: string | null; created_at: string; original_path: string; pdf_path: string | null; file_name: string | null;
             links: { seq: number; movement: { id: string; ref: string | null; description: string; op_date: string; doc_date: string | null;
               amount: string; currency: string; sign: number } | null }[] };

const TYPE: Record<string, [string, string]> = {
  invoice: ['Fattura', 'Facture'], receipt: ['Ricevuta', 'Reçu'], till_receipt: ['Scontrino', 'Ticket de caisse'],
  self_cert: ['Autocertificazione', 'Attestation sur l\'honneur'], bank_statement: ['Estratto conto', 'Relevé bancaire'],
  contract: ['Contratto', 'Contrat'], other: ['Altro', 'Autre'],
};

export default async function Documents({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; ok?: string; err?: string }> }) {
  const { q: q0 = '', f = '', ok, err } = await searchParams;
  const term = q0.trim().slice(0, 60).toLowerCase();
  const { supabase, t, lang, me } = await requireMe();
  const FR = lang === 'fr';
  const { data, error } = await supabase.from('documents')
    .select(`id, doc_type, doc_date, doc_number, total, currency, created_at, original_path, pdf_path, file_name,
      links:movement_documents(seq, movement:movements(id, ref, description, op_date, doc_date, amount, currency, sign))`)
    .order('created_at', { ascending: false }).limit(1000).returns<Doc[]>();
  // per ogni documento: il movimento principale (quello numerato prima), il nome con cui lo si riconosce
  const rows = (data ?? []).map((d) => {
    const link = [...(d.links ?? [])].sort((a, b) => (a.movement?.ref ? 0 : 1) - (b.movement?.ref ? 0 : 1))[0];
    const m = link?.movement ?? null;
    return { d, m, more: Math.max(0, (d.links ?? []).length - 1), name: docName(m?.ref, link?.seq, d.pdf_path ?? d.original_path, d.file_name) };
  });
  const shown = rows.filter((r) => (f !== 'orfani' || !r.m)
    && (!term || [r.name, r.d.file_name, r.m?.ref, r.m?.description, r.d.doc_number].some((x) => x?.toLowerCase().includes(term))));
  const orphans = rows.filter((r) => !r.m).length;
  // giustificativi senza movimento: link per scaricarli direttamente (non c'è un movimento da cui aprirli)
  const bucket = supabase.storage.from('documents');
  const orphanUrl = new Map<string, string>();
  for (const r of shown.filter((x) => !x.m).slice(0, 50)) {
    const u = (await bucket.createSignedUrl(r.d.pdf_path ?? r.d.original_path, 600, { download: r.name })).data?.signedUrl;
    if (u) orphanUrl.set(r.d.id, u);
  }
  const canLink = me!.role !== 'read_only';
  const qs = (ff: string) => { const u = new URLSearchParams(); if (ff) u.set('f', ff); if (term) u.set('q', q0.trim()); const x = u.toString(); return x ? `/documenti?${x}` : '/documenti'; };
  return (
    <div className="stack">
      <PageHead title={t('nav_documents')}>
        <FilterBar className="bare" action="/documenti" lang={lang} hidden={{ f }} search={{ value: q0, placeholder: t('search_docs') }}
          reset={term ? (f ? `/documenti?f=${f}` : '/documenti') : null} />
        <div className="seg">
          <Link href={qs('')} aria-current={f !== 'orfani' ? 'true' : undefined}>{t('all')} · {rows.length}</Link>
          <Link href={qs('orfani')} aria-current={f === 'orfani' ? 'true' : undefined}>{t('doc_orphans')} · {orphans}</Link>
        </div>
      </PageHead>
      <ErrorNote prefix={t('error_load')} error={error} />
      {ok && <p className="note ok" role="status">{FR ? `Justificatif lié à ${ok}.` : `Giustificativo collegato a ${ok}.`}</p>}
      {err && <p className="note err" role="alert">{err}</p>}
      {rows.length > 0 && <Panel>
        <div className="panel-b stack" style={{ gap: 8 }}>
          <DocsZip year={new Date().getFullYear()} lang={FR ? 'fr' : 'it'} />
        </div>
      </Panel>}
      <Panel>
        {rows.length === 0 ? <EmptyState title={t('empty_docs')} badge="clip" />
          : shown.length === 0 ? <p className="panel-b muted" style={{ margin: 0 }}>{t('empty_search_docs')}</p> : (
          <table className="t">
            <thead><tr><th>{t('doc_name')}</th><th>{t('doc_movement')}</th><th>{t('date')}</th><th className="r">{t('amount')}</th>
              <th className="hm">{t('type')}</th><th className="hm">{t('doc_uploaded')}</th></tr></thead>
            <tbody>
              {shown.map(({ d, m, more, name }) => (
                <tr key={d.id}>
                  <td>{m ? <Link className="rowlink" href={`/movimenti/${m.id}`}>{name}</Link>
                    : orphanUrl.get(d.id) ? <a href={orphanUrl.get(d.id)} className="dl-link"><Ico name="download" />{name}</a> : name}</td>
                  <td>{m ? <><span className="num">{m.ref ?? t('st_draft')}</span> <span className="muted">· {m.description}</span>
                    {more > 0 && <span className="muted"> · +{more}</span>}</> : (
                    <div className="orph">
                      <span className="chip warn">{t('doc_orphan')}</span>
                      {canLink && <form action={linkDocument} className="orph-f">
                        <input type="hidden" name="doc" value={d.id} />
                        <input className="input" name="ref" required placeholder="MOV-2026-0042" aria-label={FR ? 'Numéro du mouvement' : 'Numero del movimento'} autoCapitalize="characters" />
                        <button className="btn small" type="submit">{FR ? 'Lier' : 'Collega'}</button>
                      </form>}
                    </div>)}</td>
                  <td className="num">{date(d.doc_date ?? m?.doc_date ?? m?.op_date ?? null)}</td>
                  <td className="r num">{d.total && d.currency ? money(d.total, d.currency, lang) : m ? money(Number(m.amount) * m.sign, m.currency, lang) : '–'}</td>
                  <td className="hm"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="kind" style={{ background: 'var(--surface-2)', color: 'var(--slate-2)' }}><Ico name={TYPE_ICON[d.doc_type] ?? 'invoice'} /></span>{TYPE[d.doc_type]?.[lang === 'fr' ? 1 : 0] ?? d.doc_type}</span></td>
                  <td className="num hm">{date(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
