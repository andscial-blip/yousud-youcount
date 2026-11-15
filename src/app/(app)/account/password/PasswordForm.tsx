'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Dict } from '@/lib/i18n';

// Nuova password: almeno 10 caratteri, ripetuta due volte. Supabase la conserva solo come hash.
export function PasswordForm({ t, lang, needCurrent, email }: { t: Dict; lang: string; needCurrent: boolean; email: string }) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
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
      if (needCurrent) {
        // la password attuale si verifica rifacendo l'accesso: chi trova il telefono sbloccato non può cambiarla
        const { error: cur } = await createClient().auth.signInWithPassword({ email, password: String(f.get('p0')) });
        if (cur) { setErr(L('La password attuale non è corretta.', 'Le mot de passe actuel est incorrect.')); setBusy(false); return; }
      }
      const { error } = await createClient().auth.updateUser({ password: a });
      if (error) { setErr(`${t.err_generic}: ${error.message}`); setBusy(false); return; }
      window.location.href = '/?pw=ok';
    }}>
      <p className="muted" style={{ margin: 0 }}>{t.pw_intro}</p>
      {needCurrent && <div className="field"><label htmlFor="p0">{L('Password attuale', 'Mot de passe actuel')}</label>
        <input className="input" id="p0" name="p0" type="password" autoComplete="current-password" required /></div>}
      <div className="field"><label htmlFor="p1">{t.pw_new}</label>
        <input className="input" id="p1" name="p1" type="password" autoComplete="new-password" required minLength={10} /></div>
      <div className="field"><label htmlFor="p2">{t.pw_repeat}</label>
        <input className="input" id="p2" name="p2" type="password" autoComplete="new-password" required minLength={10} /></div>
      {err && <div className="note err" role="alert">{err}</div>}
      <div className="row-btns eq"><button className="btn primary" type="submit" disabled={busy}>{t.pw_save}</button>
        {needCurrent && <a className="btn" href="/account">{L('Annulla', 'Annuler')}</a>}</div>
    </form>
  );
}
