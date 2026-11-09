import { STAFF, can, requireMe } from '@/lib/session';
import { DOC_TYPES } from '@/lib/doc-model';
import { DocForm, type DocInit, type IssuableType } from '@/components/DocForm';
import { docFormContext } from '../context';
import { PageHead, Panel } from '@/components/Page';
import Link from 'next/link';
import { DOC_GROUPS } from '@/lib/doc-model';

export const dynamic = 'force-dynamic';

// Nuovo documento: precompilato dal movimento quando si arriva dal dettaglio (?mov=…).
export default async function NewDoc({ searchParams }: { searchParams: Promise<{ tipo?: string; mov?: string; err?: string; da?: string }> }) {
  const sp = await searchParams;
  const { supabase, me, lang } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  if (!Object.keys(DOC_TYPES).includes(sp.tipo ?? '')) return <TypePicker lang={lang} mov={sp.mov} />;
  const type = sp.tipo as IssuableType;
  const [{ data: projects }, { data: pms }, mv] = await Promise.all([
    supabase.from('projects').select('id, name').eq('active', true).order('name'),
    supabase.from('payment_methods').select('name_it, name_fr').order('sort'),
    /^[0-9a-f-]{36}$/.test(sp.mov ?? '') ? supabase.from('movements')
      .select('id, ref, fx_rate, op_date, amount, currency, description, project_id, counterparty_id, paid_by, counterparty:counterparties(name), method:payment_methods(name_it, name_fr)')
      .eq('id', sp.mov!).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  type Mv = { id: string; ref: string | null; fx_rate: string | null; op_date: string; amount: string; currency: string; description: string | null; project_id: string | null; counterparty_id: string | null;
    paid_by: string | null; counterparty: { name: string } | null; method: { name_it: string; name_fr: string | null } | null };
  const m = mv.data as unknown as Mv | null;
  const priv = m?.counterparty_id && can(me, STAFF)
    ? (await supabase.from('counterparty_private').select('tax_code, address').eq('counterparty_id', m.counterparty_id).maybeSingle()).data : null;
  const method = m?.method ? (lang === 'fr' && m.method.name_fr ? m.method.name_fr : m.method.name_it) : '';
  // «Correggi»: nuova bozza con i dati di un documento già emesso (che si annulla a parte, con il motivo)
  const src = /^[0-9a-f-]{36}$/.test(sp.da ?? '') ? (await supabase.from('issued_docs')
    .select('type, lang, movement_id, project_id, counterparty_id, party_name, party_tax_id, party_address, amount, currency, data, number').eq('id', sp.da!).maybeSingle()).data : null;
  const init: DocInit = src && src.type === type ? { type, lang: src.lang, doc_date: new Date().toISOString().slice(0, 10), movement_id: src.movement_id, project_id: src.project_id,
    counterparty_id: src.counterparty_id, party_name: src.party_name, party_tax_id: src.party_tax_id, party_address: src.party_address, amount: src.amount,
    currency: src.currency, data: { ...(src.data ?? {}), fx_rate: undefined } } : {
    type, lang: lang === 'fr' ? 'fr' : 'it', doc_date: new Date().toISOString().slice(0, 10), currency: m?.currency ?? 'EUR',
    movement_id: m?.id ?? null, project_id: m?.project_id ?? null, counterparty_id: m?.counterparty_id ?? null,
    party_name: m ? (type === 'NRS' || type === 'ASP' ? m.paid_by ?? m.counterparty?.name ?? '' : m.counterparty?.name ?? m.paid_by ?? '') : '',
    party_tax_id: priv?.tax_code ?? '', party_address: priv?.address ?? '', amount: m ? Number(m.amount) : '',
    data: m ? { method, desc: m.description ?? '', causale_txt: type === 'RIC' ? m.description ?? '' : undefined, received_on: m.op_date, paid_on: m.op_date,
      lines: type === 'NOT' ? [{ d: m.description ?? '', q: 1, p: Number(m.amount) }] : type === 'NRS' ? [{ date: m.op_date, d: m.description ?? '', amt: Number(m.amount), doc: true }] : undefined,
      deduc: true } : { deduc: true },
  };
  const fromNumber = src?.number ?? null;
  const ctx = await docFormContext(supabase);
  return (
    <div className="stack">
      <PageHead title={L(DOC_TYPES[type].it, DOC_TYPES[type].fr)} />
      {sp.err && <div className="note err">{sp.err}</div>}
      {fromNumber && <div className="note">{L(`Nuova bozza con i dati di ${fromNumber}. Dopo averla emessa, annulla ${fromNumber} indicando il motivo.`, `Nouveau brouillon avec les données de ${fromNumber}. Après l'émission, annulez ${fromNumber} en indiquant le motif.`)}</div>}
      <DocForm init={init} lang={lang} projects={projects ?? []} methods={(pms ?? []).map((p) => (lang === 'fr' && p.name_fr ? p.name_fr : p.name_it))}
               back={m ? `/movimenti/${m.id}` : '/documenti-emessi'} {...ctx} movementRate={m?.fx_rate ? Number(m.fx_rate) : null} movementRef={m?.ref ?? null} />
    </div>
  );
}

// Passo 1 del flusso «Emetti nuovo documento»: scegliere il tipo (raggruppati come nell'archivio).
function TypePicker({ lang, mov }: { lang: 'it' | 'fr'; mov?: string }) {
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const m = /^[0-9a-f-]{36}$/.test(mov ?? '') ? `&mov=${mov}` : '';
  return (
    <div className="stack">
      <PageHead title={L('Emetti nuovo documento', 'Émettre un nouveau document')} />
      <ol className="steps" aria-label={L('Passaggi', 'Étapes')}>
        <li className="on">{L('Tipo', 'Type')}</li><li>{L('Dati e anteprima', 'Données et aperçu')}</li><li>{L('Bozza salvata', 'Brouillon enregistré')}</li><li>{L('Emissione e PDF', 'Émission et PDF')}</li>
      </ol>
      {DOC_GROUPS.filter((g) => g.types.some((t) => t !== 'AUT')).map((g) => (
        <Panel key={g.k} title={L(g.it, g.fr)} pad>
          <div className="typecards">
            {g.types.filter((t) => t !== 'AUT').map((k) => {
              const T = DOC_TYPES[k as keyof typeof DOC_TYPES];
              return <Link key={k} href={`/documenti-emessi/nuovo?tipo=${k}${m}`}><b>{L(T.it, T.fr)}</b><small>{L(...T.what)}</small></Link>;
            })}
          </div>
        </Panel>
      ))}
      <p className="hint">{L('L\'autocertificazione di spesa si genera dal dettaglio di una spesa senza giustificativo, perché riprende i dati del movimento.',
        'L\'attestation de dépense se génère depuis le détail d\'une dépense sans justificatif, car elle reprend les données du mouvement.')}</p>
    </div>
  );
}
