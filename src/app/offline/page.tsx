import { Logo } from '@/components/Logo';

export const metadata = { title: 'Senza connessione' };

export default function Offline() {
  return (
    <main className="wrap" style={{ maxWidth: 480, paddingTop: 48 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Logo />
        <h1 style={{ fontSize: 22, color: 'var(--navy)' }}>Senza connessione</h1>
      </div>
      <div className="note">
        Questa pagina non era stata salvata sul dispositivo. Le pagine già aperte con la rete restano consultabili.
      </div>
    </main>
  );
}
