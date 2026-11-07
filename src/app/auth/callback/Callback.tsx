'use client';
import { useEffect, useState } from 'react';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

// Arrivo dai link delle email di Supabase (invito, nuova password).
// Gestisce le tre forme possibili del link:
//   #access_token=…&refresh_token=…   (modelli email predefiniti, flusso "implicit")
//   ?code=…                           (flusso PKCE, stesso dispositivo)
//   ?token_hash=…&type=…              (modelli personalizzati)
export function Callback() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const q = new URLSearchParams(window.location.search);
    const h = new URLSearchParams(window.location.hash.slice(1));
    const type = h.get('type') ?? q.get('type');
    const wanted = q.get('next');
    const next = wanted && wanted.startsWith('/') && !wanted.startsWith('//') ? wanted
      : type === 'invite' || type === 'recovery' ? '/account/password' : '/';

    async function run() {
      if (h.get('error') || q.get('error')) return false;
      const at = h.get('access_token'), rt = h.get('refresh_token');
      if (at && rt) return !(await supabase.auth.setSession({ access_token: at, refresh_token: rt })).error;
      const code = q.get('code');
      if (code) return !(await supabase.auth.exchangeCodeForSession(code)).error;
      const th = q.get('token_hash');
      if (th && type) return !(await supabase.auth.verifyOtp({ token_hash: th, type: type as EmailOtpType })).error;
      return false;
    }
    run().then((ok) => {
      if (ok) window.location.replace(next);
      else setFailed(true);
    }).catch(() => setFailed(true));
  }, []);

  if (!failed) return <p className="muted" role="status">Accesso in corso… · Connexion en cours…</p>;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="note err" role="alert">
        Il link non è valido o è scaduto. Chiedi un nuovo invito all’amministratore oppure usa «Password dimenticata?».<br />
        Le lien n’est pas valide ou a expiré. Demandez une nouvelle invitation ou utilisez « Mot de passe oublié ? ».
      </div>
      <div><a className="btn" href="/login">Accedi · Se connecter</a></div>
    </div>
  );
}
