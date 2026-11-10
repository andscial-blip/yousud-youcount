import Link from 'next/link';
import { FilterBar } from '@/components/FilterBar';
import { RESP, can, requireMe } from '@/lib/session';
import { date, dateTime } from '@/lib/format';
import { MESI_L } from '@/lib/viz';
import { ErrorNote, PageHead, Panel } from '@/components/Page';
import { Lines } from '@/components/Charts';
import { saveRate } from './actions';

export const dynamic = 'force-dynamic';

type Rate = { year: number; month: number; rate: string; source: string | null; updated_by: string | null; updated_at: string; demo?: boolean };

// Tassi di cambio MGA/EUR. Tre nozioni distinte:
//  · tasso del mese: quello inserito qui, proposto in automatico ai nuovi movimenti in ariary;
//  · tasso corrente: l'ultimo mese disponibile fino a oggi;
//  · tasso applicato: quello salvato su ciascun movimento, che non cambia se poi si corregge il tasso del mese.
export default async function Rates({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; anno?: string; q?: string; mese?: string }> }) {
  const sp = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  const L = (it: string, fr: string) => (lang === 'fr' ? fr : it);
  const loc = lang === 'fr' ? 'fr-FR' : 'it-IT';
  const year = Number(sp.anno) || new Date().getFullYear();
  const nowKey = new Date().toISOString().slice(0, 7);
  const [{ data: rates, error }, { data: applied }, { data: users }] = await Promise.all([
    supabase.from('fx_rates').select('year, month, rate, source, updated_by, updated_at, demo').order('year').order('month').returns<Rate[]>(),
    supabase.from('movements').select('op_date, fx_rate, amount').eq('currency', 'MGA').not('fx_rate', 'is', null).neq('status', 'draft')
      .gte('op_date', `${year}-01-01`).lte('op_date', `${year}-12-31`).limit(5000),
    supabase.rpc('user_directory'),
  ]);
  const all = rates ?? [];
  const key = (r: { year: number; month: number }) => `${r.year}-${String(r.month).padStart(2, '0')}`;
  const byKey = new Map(all.map((r) => [key(r), r]));
  const current = [...all].filter((r) => key(r) <= nowKey).pop() ?? null;
  const prevOf = (r: Rate) => all[all.indexOf(r) - 1] ?? null;
  const name = new Map(((users ?? []) as { id: string; full_name: string }[]).map((u) => [u.id, u.full_name]));
  const n = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' } as Intl.NumberFormatOptions);
  const mga = (v: number) => `${n(v, v % 1 ? 2 : 0)} MGA`;
  const pct = (a: number, b: number) => { const p = ((a - b) / b) * 100; return `${p > 0 ? '+' : ''}${n(p, 1)} %`; };
  // variazione colorata ma neutra: il cambio che sale o scende non è un bene o un male in sé
  const chg = (a: number, b: number) => { const p = ((a - b) / b) * 100; return <span className={`fxchg ${p > 0 ? 'up' : p < 0 ? 'down' : ''}`}>{p > 0 ? '↑' : p < 0 ? '↓' : '='} {pct(a, b)}</span>; };

  // tassi applicati sui movimenti in ariary dell'anno, mese per mese (media ponderata sugli importi)
  const ap = new Map<number, { w: number; s: number; min: number; max: number; c: number }>();
  for (const m of (applied ?? []) as { op_date: string; fx_rate: string; amount: string }[]) {
    const mo = Number(m.op_date.slice(5, 7)), r = Number(m.fx_rate), a = Number(m.amount);
    const x = ap.get(mo) ?? { w: 0, s: 0, min: Infinity, max: 0, c: 0 };
    x.w += a; x.s += a * r; x.min = Math.min(x.min, r); x.max = Math.max(x.max, r); x.c += 1; ap.set(mo, x);
  }
  const yr = all.filter((r) => r.year === year);
  const vals = yr.map((r) => Number(r.rate));
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const lo = vals.length ? yr.reduce((a, b) => (Number(b.rate) < Number(a.rate) ? b : a)) : null;
  const hi = vals.length ? yr.reduce((a, b) => (Number(b.rate) > Number(a.rate) ? b : a)) : null;
  const M = MESI_L[lang];
  const q = (sp.q ?? '').trim().toLowerCase();
  const rows = [...yr].reverse().filter((r) => !q || (r.source ?? '').toLowerCase().includes(q) || (name.get(r.updated_by ?? '') ?? '').toLowerCase().includes(q));
  const cur12 = current ? byKey.get(`${current.year - 1}-${String(current.month).padStart(2, '0')}`) : null;
  const edit = sp.mese && /^\d{4}-\d{2}$/.test(sp.mese) ? byKey.get(sp.mese) : null;
  const writer = can(me, RESP);

  return (
    <div className="stack">
      <PageHead title={t('nav_fx')} />
      {sp.ok && <div className="note ok" role="status">{t('fx_saved')}</div>}
      {sp.err && <div className="note err">{sp.err}</div>}
      <ErrorNote prefix={t('error_load')} error={error} />

      <div className="kpis fx-kpis">
        <div className="kpi"><div className="l">{L('Tasso corrente', 'Taux courant')}</div>
          <div className="v num">{current ? mga(Number(current.rate)) : '–'}</div>
          <div className="s">{current ? `${M[current.month - 1]} ${current.year}${current.source ? ` · ${current.source}` : ''}` : L('Nessun tasso inserito', 'Aucun taux saisi')}</div></div>
        <div className="kpi"><div className="l">{L('Rispetto al mese prima', 'Par rapport au mois précédent')}</div>
          <div className="v num">{current && prevOf(current) ? chg(Number(current.rate), Number(prevOf(current)!.rate)) : '–'}</div>
          <div className="s">{current && prevOf(current) ? `${M[prevOf(current)!.month - 1]}: ${mga(Number(prevOf(current)!.rate))}` : ''}</div></div>
        <div className="kpi"><div className="l">{L('Rispetto a un anno prima', 'Par rapport à un an plus tôt')}</div>
          <div className="v num">{current && cur12 ? chg(Number(current.rate), Number(cur12.rate)) : '–'}</div>
          <div className="s">{cur12 ? `${M[cur12.month - 1]} ${cur12.year}: ${mga(Number(cur12.rate))}` : L('Manca il tasso di un anno prima', 'Taux d\'il y a un an manquant')}</div></div>
        <div className="kpi"><div className="l">{L(`Media ${year}`, `Moyenne ${year}`)}</div>
          <div className="v num">{vals.length ? mga(Math.round(avg)) : '–'}</div>
          <div className="s">{lo && hi ? `${L('min', 'min')} ${mga(Number(lo.rate))} (${M[lo.month - 1]}) · ${L('max', 'max')} ${mga(Number(hi.rate))} (${M[hi.month - 1]})` : `${vals.length} ${L('mesi', 'mois')}`}</div></div>
      </div>

      <div className="grid">
        <Panel className="c8" title={L(`Andamento ${year} · MGA per 1 EUR`, `Évolution ${year} · MGA pour 1 EUR`)}>
          <div className="panel-b">
            {vals.length < 2 ? <div className="empty">{L('Servono almeno due mesi per il grafico.', 'Il faut au moins deux mois pour le graphique.')}</div> : (
              <Lines lang={lang} zoom unit="MGA" label={L('Tasso del mese e tasso applicato ai movimenti', 'Taux du mois et taux appliqué aux mouvements')}
                cats={M.map((m) => m.slice(0, 3))}
                series={[
                  { name: L('Tasso del mese', 'Taux du mois'), color: 'var(--pp1)', w: 3, vals: M.map((_, i) => { const r = byKey.get(`${year}-${String(i + 1).padStart(2, '0')}`); return r ? Number(r.rate) : null; }) as number[] },
                  { name: L('Applicato ai movimenti', 'Appliqué aux mouvements'), color: 'var(--pp2)', dash: '5 4', w: 2,
                    vals: M.map((_, i) => { const a = ap.get(i + 1); return a && a.w ? Math.round(a.s / a.w) : null; }) as number[] },
                ]} />
            )}
            <div className="legend"><span><i style={{ background: 'var(--vz-real)' }} />{L('Tasso del mese', 'Taux du mois')}</span>
              <span><i style={{ background: 'none', height: 0, width: 16, borderRadius: 0, borderTop: '2px dashed var(--amber-soft)', verticalAlign: 3 }} />{L('Applicato ai movimenti (media pesata)', 'Appliqué aux mouvements (moyenne pondérée)')}</span></div>
          </div>
        </Panel>
        {writer && (
          <Panel className="c4" title={edit ? L(`Correggi ${M[edit.month - 1]} ${edit.year}`, `Corriger ${M[edit.month - 1]} ${edit.year}`) : L('Inserisci un tasso', 'Saisir un taux')} pad>
            <form action={saveRate} className="stack" style={{ gap: 12 }}>
              <div className="field"><label htmlFor="month">{t('period')}</label>
                <input className="input" id="month" name="month" type="month" defaultValue={sp.mese ?? nowKey} required /></div>
              <div className="field"><label htmlFor="rate">{L('MGA per 1 EUR', 'MGA pour 1 EUR')}</label>
                <input className="input num" id="rate" name="rate" inputMode="decimal" required placeholder="5.050" defaultValue={edit ? String(Number(edit.rate)).replace('.', ',') : ''} /></div>
              <div className="field"><label htmlFor="source">{t('fx_source')}</label>
                <input className="input" id="source" name="source" maxLength={200} placeholder={L('es. BFM, banca, cambio effettivo', 'ex. BFM, banque, taux effectif')} defaultValue={edit?.source ?? ''} /></div>
              <button className="btn primary" type="submit">{t('fx_save')}</button>
              <p className="hint" style={{ margin: 0 }}>{L('Se il mese ha già un tasso, viene sostituito; i movimenti già registrati mantengono il loro.', 'Si le mois a déjà un taux, il est remplacé ; les mouvements déjà enregistrés gardent le leur.')}</p>
            </form>
          </Panel>
        )}
      </div>

      <Panel>
        <FilterBar action="/cambi" lang={lang} hidden={{ anno: String(year) }}
          search={{ value: sp.q ?? '', placeholder: L('Cerca per fonte o utente', 'Rechercher par source ou utilisateur') }}
          reset={sp.q ? `/cambi?anno=${year}` : null} />
        {rows.length === 0 ? <div className="empty">{L(`Nessun tasso per il ${year}.`, `Aucun taux pour ${year}.`)}</div> : (
          <>
          {/* telefono: un mese per scheda */}
          <ul className="fx-cards">
            {rows.map((r) => {
              const p = prevOf(r), a = ap.get(r.month);
              return (
                <li key={key(r)} className={key(r) === (current && key(current)) ? 'hl' : ''}>
                  <div className="fc-top"><span className="fc-m">{M[r.month - 1]} {r.year}{r.demo && <span className="chip warn tiny">DEMO</span>}</span>
                    <b className="num">{mga(Number(r.rate))}</b></div>
                  <div className="fc-det num">
                    <span>{L('variazione', 'variation')} {p ? pct(Number(r.rate), Number(p.rate)) : '–'}</span>
                    {a && a.w ? <span>{L('applicato', 'appliqué')} {n(Math.round(a.s / a.w))}{a.min === a.max ? '' : ` (${n(a.min)}–${n(a.max)})`}</span> : null}
                    <span>{a?.c ?? 0} {L('movimenti', 'mouvements')}</span>
                  </div>
                  <div className="fc-src"><span>{r.source ?? '–'} · {name.get(r.updated_by ?? '') ?? '–'}, {dateTime(r.updated_at, lang)}</span>
                    {writer && <Link className="btn ghost small" href={`/cambi?anno=${year}&mese=${key(r)}`}>{L('Correggi', 'Corriger')}</Link>}</div>
                </li>
              );
            })}
          </ul>
          <table className="t fx-t" data-cards="">
            <thead><tr><th>{t('period')}</th><th className="r">{L('Tasso del mese', 'Taux du mois')}</th><th className="r">{L('Variazione', 'Variation')}</th>
              <th className="r">{L('Applicato (media)', 'Appliqué (moyenne)')}</th><th className="r">{L('Movimenti', 'Mouvements')}</th><th>{t('fx_source')}</th><th>{L('Inserito da', 'Saisi par')}</th>{writer && <th />}</tr></thead>
            <tbody>
              {rows.map((r) => {
                const p = prevOf(r), a = ap.get(r.month);
                return (
                  <tr key={key(r)} className={key(r) === (current && key(current)) ? 'hl' : ''}>
                    <td className="nw" data-label={t('period')}>{M[r.month - 1]} {r.year}{r.demo && <span className="chip warn" style={{ marginLeft: 6 }}>DEMO</span>}</td>
                    <td className="r num nw" data-label={L('Tasso del mese', 'Taux du mois')}><b>{mga(Number(r.rate))}</b></td>
                    <td className="r num nw" data-label={L('Variazione', 'Variation')}>{p ? chg(Number(r.rate), Number(p.rate)) : '–'}</td>
                    <td className="r num nw" data-label={L('Applicato (media)', 'Appliqué (moyenne)')}>{a && a.w ? <span className="two"><b>{mga(Math.round(a.s / a.w))}</b>
                      <small>{a.min === a.max ? '' : `${n(a.min)}–${n(a.max)}`}</small></span> : '–'}</td>
                    <td className="r num" data-label={L('Movimenti', 'Mouvements')}>{a?.c ?? 0}</td>
                    <td className="muted" data-label={t('fx_source')}>{r.source ?? '–'}</td>
                    <td className="muted nw" data-label={L('Inserito da', 'Saisi par')}>{name.get(r.updated_by ?? '') ?? '–'}<br /><small>{dateTime(r.updated_at, lang)}</small></td>
                    {writer && <td data-label=""><Link className="btn ghost small" href={`/cambi?anno=${year}&mese=${key(r)}`}>{L('Correggi', 'Corriger')}</Link></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </>
        )}
        <div className="panel-f"><span className="muted">{L('Tasso corrente aggiornato al', 'Taux courant au')} {current ? date(`${key(current)}-01`).slice(3) : '–'}</span>
          {can(me, ['super_admin', 'admin']) && <Link className="btn ghost small" href="/admin/registro?tab=fx_rates">{L('Storico delle modifiche', 'Historique des modifications')}</Link>}</div>
      </Panel>
    </div>
  );
}
