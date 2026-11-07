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
  const fmt = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'it-IT', { month: 'long', year: 'numeric' });
  const errText = err?.startsWith('unverified_movements') ? t('closed_err') : err;
  return (
    <div className="stack">
      <PageHead title={t('nav_periods')} />
      <p className="muted" style={{ margin: 0 }}>{t('close_hint')}</p>
      <Flash ok={ok} err={errText} okText={t('saved')} />
      <Panel>
        <table className="t">
          <thead><tr><th>{t('period')}</th><th>{t('status')}</th><th className="hm">{t('closed_at')}</th><th /></tr></thead>
          <tbody>
            {months.map(({ y, m }) => {
              const key = `${y}-${String(m).padStart(2, '0')}`;
              const p = (periods ?? []).find((x) => x.year === y && x.month === m);
              const closed = Boolean(p?.closed_at);
              const open = toVerify.get(key) ?? 0;
              const current = y === now.getFullYear() && m === now.getMonth() + 1;
              return (
                <tr key={key}>
                  <td>{fmt.format(new Date(y, m - 1, 1))}</td>
                  <td>{closed ? <span className="chip ok">{t('closed')}</span>
                    : open > 0 ? <span className="chip warn">{open} {t('to_verify_short')}</span>
                    : <span className="chip">{t('open')}</span>}</td>
                  <td className="num hm">{closed ? `${dateTime(p!.closed_at, lang)} · ${name.get(p!.closed_by) ?? '–'}` : '–'}</td>
                  <td className="r">
                    {!closed && !current && (
                      <form action={closeMonth}><input type="hidden" name="ym" value={key} />
                        <button className="btn" type="submit" disabled={open > 0}><Ico name="verified" />{t('close_month')}</button></form>
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
    </div>
  );
}
