import { loadOrg } from '@/lib/org';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RESP, STAFF, can, requireMe } from '@/lib/session';
import { dateTime } from '@/lib/format';
import { buildModel, DOC_TYPES } from '@/lib/doc-model';
import { DocPreview } from '@/components/DocPreview';
import { DocForm } from '@/components/DocForm';
import { PageHead, Panel } from '@/components/Page';
import { Ico } from '@/components/Ui';
import { archiveDoc, cancelDoc, issueDoc } from '../actions';
import { docFormContext } from '../context';

export const dynamic = 'force-dynamic';

// Documento emesso: anteprima identica al PDF, modifica finché è bozza, emissione numerata, annullamento con motivo.
export default async function DocDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string; edit?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { supabase, me, lang } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const { data: d } = await supabase.from('issued_docs')
    .select('*, movement:movements(id, ref, amount, currency, amount_eur, fx_rate), project:projects(name), file:documents(original_path, file_name)').eq('id', id).maybeSingle();
  if (!d) notFound();
  const [org, { data: projects }, { data: pms }, ctx] = await Promise.all([
    loadOrg(supabase),
    supabase.from('projects').select('id, name').eq('active', true).order('name'), supabase.from('payment_methods').select('name_it, name_fr').order('sort'), docFormContext(supabase)]);
  const eur = d.movement && d.movement.currency === d.currency && Number(d.movement.amount) === Number(d.amount) ? d.movement.amount_eur : null;
  const md = buildModel({ ...d, movement_ref: d.movement?.ref ?? null, project_name: d.project?.name ?? null, amount_eur: eur },
    org);
  const pdf = d.file?.original_path ? (await supabase.storage.from('documents').createSignedUrl(d.file.original_path, 600, { download: d.file.file_name ?? `${d.number}.pdf` })).data?.signedUrl : null;
  const writer = me?.role !== 'read_only';
  const editing = d.status === 'draft' && writer && sp.edit === '1';
  const T = DOC_TYPES[d.type as keyof typeof DOC_TYPES];
  const st = d.status === 'draft' ? <span className="chip warn">{L('Bozza', 'Brouillon')}</span> : d.status === 'issued' ? <span className="chip ok">{L('Emesso', 'Émis')}</span>
    : <span className="chip bad">{L('Annullato', 'Annulé')}</span>;
  const okText = { saved: L('Bozza salvata: controlla l\'anteprima, poi emetti.', 'Brouillon enregistré : vérifiez l\'aperçu, puis émettez.'),
    issued: L('Documento emesso: numero assegnato e PDF archiviato.', 'Document émis : numéro attribué et PDF archivé.'),
    cancelled: L('Documento annullato.', 'Document annulé.'), archived: L('Documento archiviato.', 'Document archivé.'),
    restored: L('Documento riportato tra i correnti.', 'Document remis parmi les courants.') }[sp.ok ?? ''];
  return (
    <div className="stack">
      <PageHead title={`${L(T.it, T.fr)}${d.number ? ` · ${d.number}` : ''}`} lead={<Link className="btn ghost small" href="/documenti-emessi">← {L('Documenti emessi', 'Documents émis')}</Link>}>
        {st}
      </PageHead>
      {okText && <div className="note ok" role="status">{okText}</div>}
      {sp.err && <div className="note err">{sp.err}</div>}
      {d.status === 'cancelled' && <div className="note err">{L('Annullato', 'Annulé')}: {d.cancel_reason}</div>}
      <div className={editing ? 'stack' : 'split'}>
        <div className="stack">
          {editing ? (
            <DocForm init={{ ...d, type: d.type, data: d.data ?? {} }} lang={lang} projects={projects ?? []}
                     methods={(pms ?? []).map((p) => (lang === 'fr' && p.name_fr ? p.name_fr : p.name_it))} back={`/documenti-emessi/${id}`}
                     {...ctx} movementRate={d.movement?.fx_rate ? Number(d.movement.fx_rate) : null} movementRef={d.movement?.ref ?? null} />
          ) : <DocPreview md={md} />}
        </div>
        {!editing && (
        <aside className="stack">
            <Panel pad title={L('Azioni', 'Actions')}>
              <div className="stack" style={{ gap: 10 }}>
                {d.status === 'draft' && writer && !editing && <Link className="btn" href={`/documenti-emessi/${id}?edit=1`}>{L('Modifica', 'Modifier')}</Link>}
                {d.status === 'draft' && writer && (
                  <form action={issueDoc}><input type="hidden" name="id" value={id} />
                    <button className="btn primary" type="submit" style={{ width: '100%' }}><Ico name="check" />{L('Emetti e genera il PDF', 'Émettre et générer le PDF')}</button>
                    <p className="hint">{L('Dopo l\'emissione il numero è definitivo e il documento non si modifica più: si può solo annullare.',
                      'Après l\'émission, le numéro est définitif et le document ne se modifie plus : il peut seulement être annulé.')}</p></form>
                )}
                {d.status !== 'draft' && writer && <Link className="btn" href={`/documenti-emessi/nuovo?tipo=${d.type}&da=${id}`}>{L('Correggi (nuova bozza con questi dati)', 'Corriger (nouveau brouillon avec ces données)')}</Link>}
              {pdf && <a className="btn primary" href={pdf}><Ico name="download" />{L('Scarica il PDF', 'Télécharger le PDF')}</a>}
                {d.movement && <Link className="btn" href={`/movimenti/${d.movement.id}`}>{L('Movimento', 'Mouvement')} {d.movement.ref}</Link>}
                {d.status === 'draft' && writer && (
                  <form action={cancelDoc}><input type="hidden" name="id" value={id} />
                    <button className="btn danger" type="submit">{L('Elimina la bozza', 'Supprimer le brouillon')}</button></form>
                )}
                {d.status !== 'draft' && can(me, STAFF) && (
                  <form action={archiveDoc}><input type="hidden" name="id" value={id} /><input type="hidden" name="on" value={d.archived_at ? '0' : '1'} />
                    <button className="btn" type="submit" style={{ width: '100%' }}>{d.archived_at ? L('Riporta tra i correnti', 'Remettre parmi les courants') : L('Archivia', 'Archiver')}</button></form>
                )}
                {d.status === 'issued' && can(me, RESP) && (
                  <form action={cancelDoc} className="stack" style={{ gap: 6 }}><input type="hidden" name="id" value={id} />
                    <label className="flabel" htmlFor="cr">{L('Motivo dell\'annullamento', 'Motif de l\'annulation')}</label>
                    <input className="input" id="cr" name="reason" required minLength={5} maxLength={300} />
                    <button className="btn danger" type="submit">{L('Annulla il documento', 'Annuler le document')}</button></form>
                )}
              </div>
            </Panel>
            <Panel pad title={L('Registro', 'Historique')}>
              <p className="muted" style={{ margin: 0 }}>{L('Creato il', 'Créé le')} {dateTime(d.created_at, lang)}{d.issued_at ? ` · ${L('emesso il', 'émis le')} ${dateTime(d.issued_at, lang)}` : ''}</p>
            </Panel>
          </aside>
        )}
      </div>
    </div>
  );
}
