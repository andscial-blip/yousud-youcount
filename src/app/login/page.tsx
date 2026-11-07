import { Logo } from '@/components/Logo';
import { LoginForm } from './LoginForm';
import { supabaseConfigured } from '@/lib/supabase/env';

export const metadata = { title: 'Accesso' };

export default function Login() {
  return (
    <main className="wrap" style={{ maxWidth: 420, paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Logo className="logo" />
        <div>
          <h1 style={{ fontSize: 22, color: 'var(--navy)' }}>Mizana</h1>
          <div className="muted" style={{ fontSize: 13 }}>Contabilità YouSud ODV</div>
        </div>
      </div>
      <section className="panel">
        <div className="panel-h"><h2>Accedi</h2></div>
        <div className="panel-b">
          {supabaseConfigured ? <LoginForm /> : (
            <div className="note err">Collegamento al database non configurato.</div>
          )}
        </div>
      </section>
      <p className="muted" style={{ fontSize: 13 }}>
        L&apos;accesso è solo su invito. Per un nuovo account o una password dimenticata rivolgiti all&apos;amministratore di YouSud.
      </p>
    </main>
  );
}
