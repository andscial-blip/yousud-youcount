import Link from 'next/link';
import { ADMIN, can, requireMe } from '@/lib/session';
import { dateTime } from '@/lib/format';
import { Denied, PageHead, Panel } from '@/components/Page';
import { Flash } from '@/components/Admin';
import { Ico } from '@/components/Ui';
import { closeMonth } from '../actions';

export const dynamic = 'force-dynamic';

// Ultimi 18 mesi: stato, movimenti ancora da verificare, chiusura e (solo super amministratore) riapertura.
export default async function Periods({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 17, 1);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const [{ data: periods }, { data: users }, { data: pending }, { data: revs }] = await Promise.all([
    supabase.from('periods').select('year, month, closed_at, closed_by, reopen_reason'),
    supabase.rpc('user_directory'),
    supabase.from('movements').select('op_date, id').eq('status', 'recorded').gte('op_date', iso(from)),
    supabase.from('movements').select('reverses_id').not('reverses_id', 'is', null),
  ]);
  // come close_period: un movimento già stornato non blocca la chiusura
  const reversed = new Set((revs ?? []).map((r) => r.reverses_id as string));
  const name = new Map(((users ?? []) as { id: string; full_name: string }[]).map((u) => [u.id, u.full_name]));
  const toVerify = new Map<string, number>();
  for (const m of (pending ?? []).filter((x) => !reversed.has(x.id))) {
    const k = m.op_date.slice(0, 7);
    toVerify.set(k, (toVerify.get(k) ?? 0) + 1);
  }
  const months = Array.from({ length: 18 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  });
  const next = [...months].reverse().map(({ y, m }) => `${y}-${String(m).padStart(2, '0')}`)
    .find((key) => !(periods ?? []).some((x) => `${x.year}-${String(x.month).padStart(2, '0')}` === key && x.closed_at)
      && !toVerify.get(key) && key !== `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const fmt = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'it-IT', { month: 'long', year: 'numeric' });
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const errText = err?.startsWith('unverified_movements') ? t('closed_err') : err === 'confirm' ? L('Spunta la conferma per procedere.', 'Cochez la confirmation pour continuer.') : err;
  return (
    <div className="stack">
      <PageHead title={t('nav_periods')} />
      <Flash ok={ok} err={errText} okText={t('saved')} />
      {[...new Set(months.map((x) => x.y))].map((year) => {
        const ms = months.filter((x) => x.y === year);
        const st = (y: number, m: number) => {
          const key = `${y}-${String(m).padStart(2, '0')}`;
          const p = (periods ?? []).find((x) => x.year === y && x.month === m);
          return { key, p, closed: Boolean(p?.closed_at), open: toVerify.get(key) ?? 0, current: y === now.getFullYear() && m === now.getMonth() + 1 };
        };
        const nClosed = ms.filter(({ y, m }) => st(y, m).closed).length;
        return (
          <Panel key={year} title={`${year} · ${t('closed_n').replace('{n}', String(nClosed)).replace('{m}', String(ms.length))}`}>
            <table className="t">
              <thead><tr><th>{t('period')}</th><th>{t('status')}</th><th className="hm">{t('closed_at')}</th><th /></tr></thead>
              <tbody>
                {ms.map(({ y, m }) => {
                  const { key, p, closed, open, current } = st(y, m);
                  return (
                    <tr key={key} className={key === next ? 'row-next' : undefined}>
                      <td>{fmt.format(new Date(y, m - 1, 1))}</td>
                      <td>{closed ? <span className="chip ok">{t('closed')}</span>
                        : open > 0 ? <Link className="chip warn" href="/verifica">{open} {t('to_verify_short')}</Link>
                        : current ? <span className="chip">{t('period_current')}</span>
                        : <span className="chip">{t('open')}</span>}</td>
                      <td className="num hm">{closed ? `${dateTime(p!.closed_at, lang)} · ${name.get(p!.closed_by) ?? '–'}` : '–'}</td>
                      <td className="r">
                        {!closed && !current && open === 0 && (
                          <details className="pd-act">
                            <summary className={`btn ${key === next ? 'primary' : 'ghost'}`}><Ico name="verified" />{t('close_month')}</summary>
                            <form action={closeMonth} className="pd-form"><input type="hidden" name="ym" value={key} />
                              <p className="muted">{L('Dopo la chiusura nessuno può registrare, modificare o eliminare movimenti di questo mese. Solo il super amministratore può riaprirlo, indicando il motivo.',
                                'Après la clôture, personne ne peut comptabiliser, modifier ou supprimer des mouvements de ce mois. Seul le super administrateur peut le rouvrir, en indiquant le motif.')}</p>
                              <label className="check"><input type="checkbox" name="confirm" required /> {L(`Chiudo ${fmt.format(new Date(y, m - 1, 1))}`, `Je clôture ${fmt.format(new Date(y, m - 1, 1))}`)}</label>
                              <button className="btn primary" type="submit">{L('Conferma la chiusura', 'Confirmer la clôture')}</button></form>
                          </details>
                        )}
                        {closed && me!.role === 'super_admin' && (
                          <details className="pd-act">
                            <summary className="btn ghost">{t('reopen_month')}</summary>
                            <form action={closeMonth} className="pd-form"><input type="hidden" name="ym" value={key} /><input type="hidden" name="reopen" value="1" />
                              <label className="field"><span>{L('Motivo della riapertura', 'Motif de la réouverture')}</span>
                                <input className="input" name="reason" required minLength={5} maxLength={300} placeholder={L('Es. fattura di ottobre arrivata in ritardo', 'Ex. facture d’octobre arrivée en retard')} /></label>
                              <label className="check"><input type="checkbox" name="confirm" required /> {L(`Riapro ${fmt.format(new Date(y, m - 1, 1))}`, `Je rouvre ${fmt.format(new Date(y, m - 1, 1))}`)}</label>
                              <button className="btn" type="submit">{L('Conferma la riapertura', 'Confirmer la réouverture')}</button></form>
                          </details>
                        )}
                        {!closed && p?.reopen_reason && <div className="muted pd-why">{L('Riaperto', 'Rouvert')}: {p.reopen_reason}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        );
      })}
    </div>
  );
}
