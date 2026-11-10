import Link from 'next/link';
import { requireMe } from '@/lib/session';
import { HELP, HELP_SECTIONS } from '@/lib/help';
import { PageHead } from '@/components/Page';
import { PrintButton } from '@/components/PrintButton';
import { GuideSearch } from '@/components/GuideSearch';
import { CIcon } from '@/components/CIcon';
import { GUIDE_TASKS } from '@/lib/guide-tasks';
import { STAFF, can } from '@/lib/session';

export const dynamic = 'force-dynamic';

const anchor = (href: string) => href.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home';
const SEC_IC: Record<string, string> = { start: 'info', home: 'home', mov: 'list', cassa: 'bank', bud: 'wallet', prj: 'brief', anal: 'chart', docs: 'receipt', set: 'gear' };

// Guida: i primi passi in quattro schede, poi gli argomenti per sezione (gli stessi testi del pulsante (i) di ogni pagina),
// ognuno richiudibile, con ricerca. Stampabile in PDF (la stampa apre tutto).
export default async function Guide() {
  const { lang, me } = await requireMe();
  const staff = can(me, STAFF);
  const tasks = GUIDE_TASKS.filter((g) => staff || !g.staff);
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  return (
    <div className="stack guide">
      <PageHead title={L('Guida', 'Guide')}><PrintButton label={L('Stampa o salva in PDF', 'Imprimer ou enregistrer en PDF')} /></PageHead>

      <section className="g-hero2">
        <h2>{L('Come faccio a…', 'Comment faire pour…')}</h2>
        <GuideSearch placeholder={L('Cerca: rimborso, ricevuta, cambio, anticipo…', 'Rechercher : remboursement, reçu, change, avance…')}
          none={L('Nessun argomento trovato.', 'Aucun sujet trouvé.')} />
      </section>

      <section className="panel g-tasks">
        {tasks.map((g, i) => {
          const [q, steps] = lang === 'fr' ? g.fr : g.it;
          return (
            <details key={g.id} id={`come-${g.id}`} className="g-task" data-k={g.k ?? ''} open={i === 0}>
              <summary><span className="hic"><CIcon name={g.ic} size={16} /></span><span className="gt-q">{q}</span><CIcon name="arrow" size={16} /></summary>
              <div className="gt-b">
                <ol>{steps.map((st, k) => <li key={k}>{st}</li>)}</ol>
                <Link className="btn small primary no-print" href={g.href}>{L('Portami lì', 'M’y emmener')} →</Link>
              </div>
            </details>
          );
        })}
      </section>

      <h2 className="g-ref-h">{L('Tutte le pagine, una per una', 'Toutes les pages, une par une')}</h2>
      <nav className="g-idx no-print" aria-label={L('Sezioni', 'Sections')}>
        {HELP_SECTIONS.map((s) => (
          <a key={s.id} href={`#sec-${s.id}`}><CIcon name={SEC_IC[s.id] ?? 'info'} size={16} /><span>{lang === 'fr' ? s.fr : s.it}</span>
            <small>{HELP.filter((h) => h.sec === s.id).length}</small></a>
        ))}
      </nav>

      {HELP_SECTIONS.map((s) => {
        const items = HELP.filter((h) => h.sec === s.id);
        if (!items.length) return null;
        return (
          <section key={s.id} className="panel g-sec" id={`sec-${s.id}`}>
            <div className="panel-h"><h2 className="h-ic"><span className="hic"><CIcon name={SEC_IC[s.id] ?? 'info'} size={15} /></span>{lang === 'fr' ? s.fr : s.it}</h2></div>
            {items.map((h) => {
              const [title, paras] = lang === 'fr' ? h.fr : h.it;
              return (
                <details key={h.href} id={anchor(h.href)} className="g-topic">
                  <summary><span>{title}</span><CIcon name="arrow" size={16} /></summary>
                  <div className="g-body">
                    {paras.map((p, k) => <p key={k}>{p}</p>)}
                    <Link className="btn small no-print" href={h.href}>{L('Vai alla pagina', 'Aller à la page')} →</Link>
                  </div>
                </details>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
