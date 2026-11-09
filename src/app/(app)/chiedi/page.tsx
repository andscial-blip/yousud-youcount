import { requireMe } from '@/lib/session';
import { PageHead, Panel } from '@/components/Page';
import { AskAI } from '@/components/AskAI';

export const dynamic = 'force-dynamic';

export default async function Ask({ searchParams }: { searchParams: Promise<{ anno?: string }> }) {
  const sp = await searchParams;
  const { lang } = await requireMe();
  const year = Number(sp.anno) || new Date().getFullYear();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const suggestions = [
    L(`Come stanno andando entrate e uscite nel ${year} rispetto all'anno prima?`, `Comment évoluent recettes et dépenses en ${year} par rapport à l'année précédente ?`),
    L('Quali voci di spesa sono oltre il preventivo?', 'Quels postes de dépense dépassent le budget ?'),
    L('Quanto abbiamo speso per ciascuna scuola?', 'Combien avons-nous dépensé pour chaque école ?'),
    L('Quanta liquidità abbiamo in Madagascar e per quanti mesi basta?', 'Combien de liquidités à Madagascar et pour combien de mois ?'),
    L('Quali sono le spese più grandi dell\'anno?', 'Quelles sont les plus grosses dépenses de l\'année ?'),
  ];
  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <PageHead title={L('Chiedi all\'AI', 'Demander à l\'IA')} />
      <Panel title={L(`Domande sui conti ${year}`, `Questions sur les comptes ${year}`)} icon="spark" pad>
        <AskAI year={year} lang={lang} suggestions={suggestions} />
      </Panel>
    </div>
  );
}
