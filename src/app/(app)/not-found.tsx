import Link from 'next/link';
import { requireMe } from '@/lib/session';

// Pagina «non trovato» dentro l'app, nella lingua dell'utente (revisione 14/11: prima usciva la pagina inglese del framework)
export default async function NotFound() {
  const { t } = await requireMe();
  return (
    <section className="panel" style={{ maxWidth: 560 }}>
      <div className="panel-h"><h2>{t('nf_title')}</h2></div>
      <div className="panel-b">
        <p style={{ margin: '0 0 14px' }}>{t('nf_text')}</p>
        <div className="row-btns eq"><Link className="btn primary" href="/">{t('nf_home')}</Link><Link className="btn" href="/movimenti">{t('nf_list')}</Link></div>
      </div>
    </section>
  );
}
