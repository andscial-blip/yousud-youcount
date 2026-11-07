import { can, requireMe, RESP } from '@/lib/session';
import { Denied, Empty, PageHead, Panel } from '@/components/Page';
import { saveRate } from './actions';

export const dynamic = 'force-dynamic';

export default async function Rates({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, RESP)) return <Denied text={t('only_staff')} />;
  const { data } = await supabase.from('fx_rates').select('year, month, rate, source, updated_at')
    .order('year', { ascending: false }).order('month', { ascending: false }).limit(36);
  const fmt = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'it-IT', { month: 'long', year: 'numeric' });
  const thisMonth = new Date().toISOString().slice(0, 7);
  return (
    <div className="stack" style={{ maxWidth: 920 }}>
      <PageHead title={t('nav_fx')} />
      <p className="muted" style={{ margin: 0 }}>{t('fx_intro')}</p>
      {ok && <div className="note ok" role="status">{t('fx_saved')}</div>}
      {err && <div className="note err">{err}</div>}
      <Panel pad>
        <form action={saveRate} className="fgrid" style={{ alignItems: 'end' }}>
          <div className="field"><label htmlFor="month">{t('period')}</label>
            <input className="input" id="month" name="month" type="month" defaultValue={thisMonth} required /></div>
          <div className="field"><label htmlFor="rate">{t('f_rate')}</label>
            <input className="input num" id="rate" name="rate" inputMode="decimal" required placeholder="5 050" /></div>
          <div className="field"><label htmlFor="source">{t('fx_source')}</label>
            <input className="input" id="source" name="source" placeholder="BCE, Banky Foiben'i Madagasikara, cambio effettivo…" /></div>
          <div><button className="btn primary" type="submit">{t('fx_save')}</button></div>
        </form>
      </Panel>
      <Panel>
        {(data ?? []).length === 0 ? <Empty text={t('none')} /> : (
          <table className="t">
            <thead><tr><th>{t('period')}</th><th className="r">{t('f_rate')}</th><th>{t('fx_source')}</th></tr></thead>
            <tbody>
              {data!.map((r) => (
                <tr key={`${r.year}-${r.month}`}>
                  <td>{fmt.format(new Date(r.year, r.month - 1, 1))}</td>
                  <td className="r num">{Number(r.rate).toLocaleString(lang === 'fr' ? 'fr-FR' : 'it-IT')}</td>
                  <td className="muted">{r.source ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
