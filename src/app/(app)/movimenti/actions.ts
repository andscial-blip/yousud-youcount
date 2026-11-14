'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireMe } from '@/lib/session';
import { withFreshPassword } from '@/lib/reauth';

// Svuota l'elenco: elimina definitivamente tutti i movimenti (solo super amministratore, da Impostazioni › Dati e sicurezza). Conferma, numero dei movimenti,
// motivo, password reinserita e backup delle ultime 24 ore: i controlli veri sono nel database (movement_purge_all).
export async function purgeAllAction(form: FormData) {
  const fail = (m: string) => redirect(`/admin/dati?err=${encodeURIComponent(m)}#svuota`);
  if (form.get('confirm') !== 'on') fail('Spunta la conferma per eliminare tutti i movimenti.');
  const { user } = await requireMe();
  const r = await withFreshPassword(user.email, String(form.get('password') ?? ''), async (sb): Promise<string> => {
    const { error } = await sb.rpc('movement_purge_all', { p_expected: Number(form.get('expected')), p_reason: String(form.get('reason') ?? '') });
    return error?.message ?? '';
  });
  const msg = r.ok ? r.value : r.error;
  if (msg) fail(msg);
  revalidatePath('/', 'layout');
  redirect('/admin/dati?ok=purged_all');
}
