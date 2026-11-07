import { requireMe, ROLE_LABEL } from '@/lib/session';
import { SignOut } from '@/components/SignOut';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Altro' };

export default async function More() {
  const { me, user } = await requireMe();
  return (
    <div className="stack">
      <h1 style={{ fontSize: 22 }}>Altro</h1>
      <section className="panel">
        <div className="panel-h"><h2>Il mio account</h2></div>
        <div className="panel-b stack">
          <div><span className="muted">Nome</span><br />{me?.full_name || '–'}</div>
          <div><span className="muted">Email</span><br />{user.email}</div>
          <div><span className="muted">Ruolo</span><br />{me ? ROLE_LABEL[me.role] : '–'}</div>
          <div><SignOut /></div>
        </div>
      </section>
      <p className="muted" style={{ margin: 0 }}>Gestione utenti, conti e codici: tappa 4e.</p>
    </div>
  );
}
