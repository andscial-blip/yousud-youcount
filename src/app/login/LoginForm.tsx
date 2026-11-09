'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Labels = { email: string; password: string; btn: string; busy: string; bad: string; offline: string };

export function LoginForm({ labels: L }: { labels: Labels }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // link email arrivato sull'indirizzo base: i dati di accesso sono dopo il #, li gestisce /auth/callback
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('access_token=') || hash.includes('error=')) window.location.replace(`/auth/callback${hash}`);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(f.get('email') ?? '').trim(),
      password: String(f.get('password') ?? ''),
    });
    if (error) {
      setBusy(false);
      setError(navigator.onLine ? L.bad : L.offline);
      return;
    }
    const next = new URLSearchParams(window.location.search).get('next');
    window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  }

  return (
    <form onSubmit={onSubmit} className="stack" style={{ gap: 14 }}>
      <div className="field">
        <label htmlFor="email">{L.email}</label>
        <input className="input" id="email" name="email" type="email" autoComplete="username" inputMode="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">{L.password}</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && <div className="note err" role="alert">{error}</div>}
      <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%', minHeight: 46, marginTop: 4 }}>{busy ? L.busy : L.btn}</button>
    </form>
  );
}
