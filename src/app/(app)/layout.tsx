import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { BottomNav, TopNav } from '@/components/Nav';
import { supabaseConfigured } from '@/lib/supabase/env';
import { requireMe, ROLE_LABEL } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <Shell who={null}><ConfigMissing /></Shell>;
  const { me, user } = await requireMe();
  if (!me || !me.active) {
    return (
      <Shell who={null}>
        <div className="note err">
          Account {me ? 'sospeso' : 'senza profilo'} ({user.email}). Rivolgiti all&apos;amministratore di YouSud.
        </div>
      </Shell>
    );
  }
  return <Shell who={`${me.full_name || user.email} · ${ROLE_LABEL[me.role]}`}>{children}</Shell>;
}

function Shell({ who, children }: { who: string | null; children: React.ReactNode }) {
  return (
    <>
      <header className="top">
        <div className="wrap">
          <Link href="/" aria-label="Cruscotto" style={{ display: 'flex' }}><Logo /></Link>
          <div className="brand">
            <b>Mizana</b>
            <span>Contabilità YouSud ODV</span>
          </div>
          <div className="spacer" />
          {who && <span className="desk muted" style={{ color: 'rgba(255,255,255,.8)', fontSize: 13 }}>{who}</span>}
          <Link className="btn primary desk" href="/nuovo">+ Nuovo movimento</Link>
          <Link className="btn ghost mob" href="/altro" aria-label="Altro" style={{ color: '#fff' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </Link>
        </div>
      </header>
      <TopNav />
      <main className="wrap">{children}</main>
      <BottomNav />
    </>
  );
}

function ConfigMissing() {
  return (
    <div className="panel">
      <div className="panel-h"><h2>Collegamento al database non configurato</h2></div>
      <div className="panel-b stack">
        <p style={{ margin: 0 }}>
          Mancano le variabili <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
          Copia <code>.env.example</code> in <code>.env.local</code> e inserisci i valori del progetto Supabase.
        </p>
        <p className="muted" style={{ margin: 0 }}>Nessun dato viene mostrato finché il collegamento non è attivo.</p>
      </div>
    </div>
  );
}
