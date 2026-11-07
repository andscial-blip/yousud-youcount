'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Dict } from '@/lib/i18n';

// Nuova password: almeno 10 caratteri, ripetuta due volte. Supabase la conserva solo come hash.
export function PasswordForm({ t }: { t: Dict }) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const a = String(f.get('p1')), b = String(f.get('p2'));
      if (a.length < 10) return setErr(t.pw_short);
      if (a !== b) return setErr(t.pw_mismatch);
      setBusy(true);
      const { error } = await createClient().auth.updateUser({ password: a });
      if (error) { setErr(`${t.err_generic}: ${error.message}`); setBusy(false); return; }
      window.location.href = '/?pw=ok';
    }}>
      <p className="muted" style={{ margin: 0 }}>{t.pw_intro}</p>
      <div className="field"><label htmlFor="p1">{t.pw_new}</label>
        <input className="input" id="p1" name="p1" type="password" autoComplete="new-password" required minLength={10} /></div>
      <div className="field"><label htmlFor="p2">{t.pw_repeat}</label>
        <input className="input" id="p2" name="p2" type="password" autoComplete="new-password" required minLength={10} /></div>
      {err && <div className="note err" role="alert">{err}</div>}
      <div><button className="btn primary" type="submit" disabled={busy}>{t.pw_save}</button></div>
    </form>
  );
}
