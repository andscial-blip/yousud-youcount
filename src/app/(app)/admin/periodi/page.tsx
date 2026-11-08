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
    supabase.from('periods').select('year, month, closed_at, closed_by'),
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
  const errText = err?.startsWith('unverified_movements') ? t('closed_err') : err;
  return (
    <div className="stack">
      <PageHead title={t('nav_periods')} />
      <p className="muted" style={{ margin: 0 }}>{t('close_hint')}</p>
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
                          <form action={closeMonth}><input type="hidden" name="ym" value={key} />
                            <button className={`btn ${key === next ? 'primary' : 'ghost'}`} type="submit"><Ico name="verified" />{t('close_month')}</button></form>
                        )}
                        {closed && me!.role === 'super_admin' && (
                          <form action={closeMonth}><input type="hidden" name="ym" value={key} /><input type="hidden" name="reopen" value="1" />
                            <button className="btn ghost" type="submit">{t('reopen_month')}</button></form>
                        )}
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
