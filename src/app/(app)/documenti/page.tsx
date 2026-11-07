import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { docName } from '@/lib/doc-name';
import { date, money } from '@/lib/format';
import { ErrorNote, PageHead, Panel } from '@/components/Page';
import { EmptyState, Ico } from '@/components/Ui';
import type { IconName } from '@/lib/icons';

const TYPE_ICON: Record<string, IconName> = { invoice: 'invoice', receipt: 'receipt', till_receipt: 'receipt', self_cert: 'selfCert', bank_statement: 'invoice', contract: 'invoice', other: 'invoice' };

export const dynamic = 'force-dynamic';

type Doc = { id: string; doc_type: string; doc_date: string | null; doc_number: string | null; total: string | null;
             currency: string | null; created_at: string; original_path: string; pdf_path: string | null; file_name: string | null;
             links: { seq: number; movement: { id: string; ref: string | null } | null }[] };

const TYPE: Record<string, [string, string]> = {
  invoice: ['Fattura', 'Facture'], receipt: ['Ricevuta', 'Reçu'], till_receipt: ['Scontrino', 'Ticket de caisse'],
  self_cert: ['Autocertificazione', 'Attestation sur l\'honneur'], bank_statement: ['Estratto conto', 'Relevé bancaire'],
  contract: ['Contratto', 'Contrat'], other: ['Altro', 'Autre'],
};

export default async function Documents() {
  const { supabase, t, lang } = await requireMe();
  const { data, error } = await supabase.from('documents')
    .select('id, doc_type, doc_date, doc_number, total, currency, created_at, original_path, pdf_path, file_name, links:movement_documents(seq, movement:movements(id, ref))')
    .order('created_at', { ascending: false }).limit(200).returns<Doc[]>();
  return (
    <div className="stack">
      <PageHead title={t('nav_documents')} />
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {(data ?? []).length === 0 ? <EmptyState title={t('empty_docs')} badge="clip" /> : (
          <table className="t">
            <thead><tr><th>{t('doc_name')}</th><th>{t('doc_uploaded')}</th><th>{t('type')}</th><th>{t('doc_number')}</th><th>{t('date')}</th>
              <th className="r">{t('doc_total')}</th></tr></thead>
            <tbody>
              {data!.map((d) => {
                const link = [...(d.links ?? [])].sort((a, b) => (a.movement?.ref ? 0 : 1) - (b.movement?.ref ? 0 : 1))[0];
                const name = docName(link?.movement?.ref, link?.seq, d.pdf_path ?? d.original_path, d.file_name);
                return (
                <tr key={d.id}>
                  <td>{link?.movement ? <Link href={`/movimenti/${link.movement.id}`}>{name}</Link> : name}</td>
                  <td className="num">{date(d.created_at)}</td>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span className="kind" style={{ background: 'var(--surface-2)', color: 'var(--slate-2)' }}><Ico name={TYPE_ICON[d.doc_type] ?? 'invoice'} /></span>{TYPE[d.doc_type]?.[lang === 'fr' ? 1 : 0] ?? d.doc_type}</span></td>
                  <td>{d.doc_number ?? '–'}</td><td className="num">{date(d.doc_date)}</td>
                  <td className="r num">{d.total && d.currency ? money(d.total, d.currency, lang) : '–'}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
