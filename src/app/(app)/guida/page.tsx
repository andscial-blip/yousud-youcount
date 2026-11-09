import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { HELP, HELP_SECTIONS } from '@/lib/help';
import { PageHead, Panel } from '@/components/Page';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

const anchor = (href: string) => href.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home';

// Guida completa: le stesse spiegazioni del pulsante (i) di ogni scheda, ordinate come il menu. Stampabile in PDF.
export default async function Guide() {
  const { t, lang } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  return (
    <div className="stack">
      <PageHead title={t('nav_guide')}><PrintButton label={L('Stampa o salva in PDF', 'Imprimer ou enregistrer en PDF')} /></PageHead>
      <p className="muted" style={{ margin: 0 }}>{L('Come funziona ogni scheda di YouCount. In ogni pagina il pulsante (i) in alto mostra la parte che riguarda quella pagina.',
        'Comment fonctionne chaque onglet de YouCount. Sur chaque page, le bouton (i) en haut affiche la partie qui concerne cette page.')}</p>
      <nav className="guide-idx quick" aria-label={L('Indice', 'Index')}>
        {HELP_SECTIONS.map((s) => <a key={s.id} href={`#sec-${s.id}`}>{lang === 'fr' ? s.fr : s.it}</a>)}
      </nav>
      {HELP_SECTIONS.map((s) => {
        const items = HELP.filter((h) => h.sec === s.id);
        if (!items.length) return null;
        return (
          <Panel key={s.id} title={lang === 'fr' ? s.fr : s.it} className="guide-sec">
            <div id={`sec-${s.id}`} />
            {items.map((h) => {
              const [title, paras] = lang === 'fr' ? h.fr : h.it;
              return (
                <section key={h.href} id={anchor(h.href)} className="guide-e">
                  <h3>{title} <Link className="no-print" href={h.href}>{L('apri', 'ouvrir')} →</Link></h3>
                  {paras.map((p, i) => <p key={i}>{p}</p>)}
                </section>
              );
            })}
          </Panel>
        );
      })}
    </div>
  );
}
