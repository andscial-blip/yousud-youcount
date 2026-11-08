import { docName } from '@/lib/doc-name';
import { notFound } from 'next/navigation';
import { requireMe } from '@/lib/session';
import { dictFor } from '@/lib/i18n';
import { loadRefData } from '@/lib/movement-ref';
import { PageHead } from '@/components/Page';
import { MovementForm, type Initial } from '@/components/MovementForm';

export const dynamic = 'force-dynamic';

export default async function EditMovement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, me, t, lang } = await requireMe();
  const { data: m } = await supabase.from('movements')
    .select(`id, ref, version, status, kind, op_date, doc_date, description, amount, currency, fx_rate, account_id, to_account_id,
             to_amount, category_id, project_id, grant_id, counterparty_id, payment_method_id, notes, no_doc_reason, paid_by, reimb_status,
             links:movement_documents(seq, document:documents(id, original_path, pdf_path, file_name))`)
    .eq('id', id).maybeSingle();
  if (!m) notFound();
  type L = { seq: number; document: { id: string; original_path: string; pdf_path: string | null; file_name: string | null } | null };
  const links = ((m.links ?? []) as unknown as L[]).filter((l) => l.document).sort((a, b) => a.seq - b.seq);
  const initial = {
    ...m,
    docs: links.map((l) => ({ id: l.document!.id,
      label: docName(m.ref as string | null, l.seq, l.document!.pdf_path ?? l.document!.original_path, l.document!.file_name) })),
  } as unknown as Initial;
  const refData = await loadRefData(supabase, me!, lang);
  return (
    <div className="stack">
      <PageHead title={`${t('f_edit_title')}`} />
      <MovementForm refData={refData} t={dictFor(lang)} initial={initial} />
    </div>
  );
}
