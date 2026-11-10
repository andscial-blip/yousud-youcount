'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LOGO_MAX } from '@/lib/org';

const KEYS = ['four_eyes', 'require_document', 'ai_reading'];

// Attiva o disattiva un'impostazione dell'ente (solo amministratori: lo garantisce la RLS).
export async function toggleSetting(form: FormData) {
  const key = String(form.get('key'));
  if (!KEYS.includes(key)) redirect('/admin/impostazioni?err=invalid');
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from('profiles').select('org_id').eq('id', auth.user!.id).single();
  const { error } = await supabase.from('settings').upsert({
    org_id: me!.org_id, key, value: form.get('value') === 'true', updated_by: auth.user!.id, updated_at: new Date().toISOString(),
  });
  revalidatePath('/', 'layout');
  redirect(error ? `/admin/impostazioni?err=${encodeURIComponent(error.message)}` : '/admin/impostazioni?ok=1');
}

// Dati dell'ente e firmatario per i documenti generati (autocertificazioni). Solo amministratori (RLS).
export async function saveDocDetails(form: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from('profiles').select('org_id').eq('id', auth.user!.id).single();
  const s = (k: string, max: number) => String(form.get(k) ?? '').trim().slice(0, max);
  const now = new Date().toISOString();
  const { error } = await supabase.from('settings').upsert([
    { org_id: me!.org_id, key: 'org_details', value: { legal_name: s('legal_name', 120), address: s('address', 300), tax_id: s('tax_id', 40), iban: s('iban', 40).replace(/\s+/g, ''), runts: s('runts', 200), email: s('email', 120), phone: s('phone', 40), web: s('web', 120) }, updated_by: auth.user!.id, updated_at: now },
    { org_id: me!.org_id, key: 'doc_signer', value: { name: s('signer', 120), role: s('signer_role', 120) }, updated_by: auth.user!.id, updated_at: now },
  ]);
  revalidatePath('/', 'layout');
  redirect(error ? `/admin/impostazioni?err=${encodeURIComponent(error.message)}` : '/admin/impostazioni?ok=1');
}

// Logo dell'ente per i documenti: PNG o JPEG già ridimensionato nel browser; qui si controlla che sia davvero
// un'immagine che il PDF sa incorporare. Solo amministratori (RLS sulle impostazioni).
export async function saveLogo(form: FormData) {
  const mime = String(form.get('mime') ?? ''), data = String(form.get('data') ?? '').replace(/\s+/g, '');
  const bad = () => redirect('/admin/impostazioni?err=' + encodeURIComponent('Logo non valido: usa un file PNG o JPEG.'));
  if (!['image/png', 'image/jpeg'].includes(mime) || !data || data.length > LOGO_MAX || !/^[A-Za-z0-9+/]+=*$/.test(data)) bad();
  const bytes = Buffer.from(data, 'base64');
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if ((mime === 'image/png' && !png) || (mime === 'image/jpeg' && !jpg)) bad();
  try {
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    if (png) await doc.embedPng(bytes); else await doc.embedJpg(bytes);
  } catch { bad(); }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from('profiles').select('org_id').eq('id', auth.user!.id).single();
  const { error } = await supabase.from('settings').upsert({ org_id: me!.org_id, key: 'org_logo', value: { mime, data },
    updated_by: auth.user!.id, updated_at: new Date().toISOString() });
  revalidatePath('/', 'layout');
  redirect(error ? `/admin/impostazioni?err=${encodeURIComponent(error.message)}` : '/admin/impostazioni?ok=1');
}

// Toglie il logo (i documenti già emessi restano come sono: il PDF è archiviato).
export async function removeLogo() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from('profiles').select('org_id').eq('id', auth.user!.id).single();
  const { error } = await supabase.from('settings').upsert({ org_id: me!.org_id, key: 'org_logo', value: {},
    updated_by: auth.user!.id, updated_at: new Date().toISOString() });
  revalidatePath('/', 'layout');
  redirect(error ? `/admin/impostazioni?err=${encodeURIComponent(error.message)}` : '/admin/impostazioni?ok=1');
}

// Dati dimostrativi (solo amministratori): caricamento dall'insieme preparato in src/lib/demo, svuotamento con
// conferma del numero di movimenti demo (se nel frattempo è cambiato, il database rifiuta).
export async function loadDemo() {
  const { buildDemo } = await import('@/lib/demo/build');
  const supabase = await createClient();
  const { error } = await supabase.rpc('demo_load', { p: buildDemo(new Date().getFullYear()) });
  revalidatePath('/', 'layout');
  redirect(error ? `/admin/dati?err=${encodeURIComponent(error.message)}#demo` : '/admin/dati?ok=demo_loaded#demo');
}
export async function purgeDemo(form: FormData) {
  const supabase = await createClient();
  if (form.get('confirm') !== 'on') redirect('/admin/dati?err=' + encodeURIComponent('Spunta la conferma per svuotare i dati dimostrativi.') + '#demo');
  const { error } = await supabase.rpc('demo_purge', { p_expected: Number(form.get('expected')) });
  revalidatePath('/', 'layout');
  redirect(error ? `/admin/dati?err=${encodeURIComponent(error.message)}#demo` : '/admin/dati?ok=demo_purged#demo');
}

// Azzeramento prima dell'avvio: elimina tutti i movimenti e tutti i preventivi (solo super amministratore,
// con backup delle ultime 24 ore, numeri confermati e parola «AZZERA»: i controlli veri sono nel database).
export async function resetAccounting(form: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('reset_accounting', {
    p_movements: Number(form.get('movements')), p_budgets: Number(form.get('budgets')), p_word: String(form.get('word') ?? '').trim(),
  });
  revalidatePath('/', 'layout');
  redirect(error ? `/admin/dati?err=${encodeURIComponent(error.message)}#azzera`
    : `/admin/dati?ok=reset&n=${data?.deleted?.movements ?? 0}&b=${data?.deleted?.budgets ?? 0}#azzera`);
}

// Sede in Madagascar (scelta 9c del 10/11): dati dell'accordo di sede e della presenza locale, inseriti dall'amministratore.
// Se c'è la data di scadenza, crea o sposta in Scadenze il promemoria di rinnovo 6 mesi prima.
const MG_FIELDS: [string, number][] = [['agreement_no', 80], ['signed_on', 10], ['expires_on', 10], ['ministries', 300], ['rep_name', 120], ['rep_mandate', 200],
  ['nif', 40], ['stat', 40], ['cnaps', 40], ['ostie', 40], ['address', 300], ['zones', 300], ['accounts', 1000], ['exemptions', 1000], ['notes', 1000]];
export async function saveMgSeat(form: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data: me } = await supabase.from('profiles').select('org_id').eq('id', auth.user!.id).single();
  const { data: cur } = await supabase.from('settings').select('value').eq('key', 'mg_seat').maybeSingle();
  const v: Record<string, string> = {};
  for (const [k, max] of MG_FIELDS) v[k] = String(form.get(k) ?? '').trim().slice(0, max);
  for (const k of ['signed_on', 'expires_on']) if (v[k] && !/^\d{4}-\d{2}-\d{2}$/.test(v[k]!)) v[k] = '';
  let deadline_id = ((cur?.value ?? {}) as { deadline_id?: string }).deadline_id ?? '';
  if (v.expires_on) {
    const d = new Date(`${v.expires_on}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 6);
    const p = (id?: string) => supabase.rpc('deadline_save', { p: {
      id, title: 'Rinnovo accordo di sede in Madagascar', category: 'doc', priority: 'high',
      due_date: d.toISOString().slice(0, 10),
      notes: `Accordo${v.agreement_no ? ` n° ${v.agreement_no}` : ''} in scadenza il ${v.expires_on.split('-').reverse().join('/')}. Avviare il rinnovo con il ministero competente.`,
    } });
    let { data: dl, error: e1 } = await p(deadline_id || undefined);
    if (e1 && deadline_id) ({ data: dl, error: e1 } = await p(undefined)); // promemoria cancellato a mano: se ne crea uno nuovo
    if (e1) redirect(`/admin/impostazioni?err=${encodeURIComponent(e1.message)}#sede-mg`);
    deadline_id = (dl as { id?: string } | null)?.id ?? deadline_id;
  }
  const { error } = await supabase.from('settings').upsert({ org_id: me!.org_id, key: 'mg_seat', value: { ...v, deadline_id },
    updated_by: auth.user!.id, updated_at: new Date().toISOString() });
  revalidatePath('/', 'layout');
  redirect(error ? `/admin/impostazioni?err=${encodeURIComponent(error.message)}#sede-mg` : '/admin/impostazioni?ok=mg#sede-mg');
}
