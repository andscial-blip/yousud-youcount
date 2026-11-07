'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      setError(navigator.onLine ? 'Email o password non corretti.' : 'Serve una connessione per il primo accesso.');
      return;
    }
    const next = new URLSearchParams(window.location.search).get('next');
    window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  }

  return (
    <form onSubmit={onSubmit} className="stack" style={{ gap: 14 }}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && <div className="note err" role="alert">{error}</div>}
      <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Accesso…' : 'Accedi'}</button>
    </form>
  );
}
