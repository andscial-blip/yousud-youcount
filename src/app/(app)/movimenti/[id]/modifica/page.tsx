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
    .select(`id, version, status, kind, op_date, doc_date, description, amount, currency, fx_rate, account_id, to_account_id,
             to_amount, category_id, project_id, counterparty_id, payment_method_id, notes, no_doc_reason,
             links:movement_documents(document:documents(id, original_path, file_name))`)
    .eq('id', id).maybeSingle();
  if (!m) notFound();
  const links = (m.links ?? []) as unknown as { document: { id: string; original_path: string; file_name: string | null } | null }[];
  const initial = {
    ...m,
    docs: links.map((l) => l.document).filter(Boolean).map((d) => ({ id: d!.id, label: d!.file_name ?? d!.original_path.split('/').pop()! })),
  } as unknown as Initial;
  const refData = await loadRefData(supabase, me!, lang);
  return (
    <div className="stack">
      <PageHead title={`${t('f_edit_title')}`} />
      <MovementForm refData={refData} t={dictFor(lang)} initial={initial} />
    </div>
  );
}
