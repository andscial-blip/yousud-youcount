import { ADMIN, can, requireMe } from '@/lib/session';
import { money, nm } from '@/lib/format';
import { Denied, Empty, ErrorNote, PageHead, Panel } from '@/components/Page';
import { EditRow, F, Flash, Hidden, SaveBar } from '@/components/Admin';
import { saveRow } from '../actions';

export const dynamic = 'force-dynamic';

const KIND: Record<string, [string, string]> = {
  bank: ['Banca', 'Banque'], cash: ['Cassa', 'Caisse'], mobile: ['Mobile money / online', 'Mobile money / en ligne'],
  advance: ['Anticipi', 'Avances'], other: ['Altro', 'Autre'],
};

type A = { id: string; code: string; name_it: string; name_fr: string; currency: string; location: string; kind: string;
           opening_balance: string; opening_date: string | null; active: boolean; sort: number };

export default async function AdminAccounts({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const { ok, err } = await searchParams;
  const { supabase, me, t, lang } = await requireMe();
  if (!can(me, ADMIN)) return <Denied text={t('only_admin')} />;
  const { data, error } = await supabase.from('accounts')
    .select('id, code, name_it, name_fr, currency, location, kind, opening_balance, opening_date, active, sort').order('sort').returns<A[]>();
  const L = lang === 'fr' ? 1 : 0;
  const nextSort = Math.max(0, ...(data ?? []).map((a) => a.sort)) + 10;
  return (
    <div className="stack">
      <PageHead title={t('nav_admin_accounts')} />
      <p className="muted" style={{ margin: 0 }}>{t('admin_readonly')}</p>
      <Flash ok={ok} err={err} okText={t('saved')} />
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {(data ?? []).length === 0 ? <Empty text={t('none')} /> : data!.map((a) => (
          <EditRow key={a.id} inactive={!a.active} summary={<>
            <b className="grow">{nm(lang, a)}</b>
            <span className="muted meta">{KIND[a.kind]?.[L] ?? a.kind} · {a.location === 'IT' ? t('italy') : t('madagascar')}</span>
            <span className="num amt">{t('acc_opening')}: {money(a.opening_balance, a.currency, lang)}</span>
            {!a.active && <span className="chip">{t('inactive')}</span>}
          </>}>
            <form action={saveRow} className="fgrid">
              <Hidden v={{ _table: 'accounts', id: a.id }} />
              <F label={t('name_it_l')}><input className="input" name="name_it" defaultValue={a.name_it} required /></F>
              <F label={t('name_fr_l')}><input className="input" name="name_fr" defaultValue={a.name_fr} /></F>
              <F label={`${t('acc_opening')} (${a.currency})`}><input className="input num" name="opening_balance" inputMode="decimal" defaultValue={a.opening_balance} /></F>
              <F label={t('opening_date')}><input className="input" type="date" name="opening_date" defaultValue={a.opening_date ?? ''} /></F>
              <F label={t('sort_l')}><input className="input num" name="sort" inputMode="numeric" defaultValue={a.sort} /></F>
              <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" name="active" defaultChecked={a.active} /> {t('active')}</label>
              <p className="hint span2" style={{ margin: 0 }}>{t('code')}: {a.code} · {t('currency')}: {a.currency} · {t('retro_warn')}</p>
              <SaveBar label={t('save')} />
            </form>
          </EditRow>
        ))}
      </Panel>
      <Panel title={t('a_new')} pad>
        <form action={saveRow} className="fgrid">
          <Hidden v={{ _table: 'accounts', sort: String(nextSort) }} />
          <F label={t('name_it_l')}><input className="input" name="name_it" required /></F>
          <F label={t('name_fr_l')}><input className="input" name="name_fr" /></F>
          <F label={t('code')}><input className="input" name="code" required maxLength={60} /></F>
          <F label={t('type')}>
            <select className="input" name="kind" defaultValue="bank">
              {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v[L]}</option>)}
            </select></F>
          <F label={t('currency')}>
            <select className="input" name="currency" defaultValue="EUR"><option>EUR</option><option>MGA</option></select></F>
          <F label={t('place')}>
            <select className="input" name="location" defaultValue="IT"><option value="IT">{t('italy')}</option><option value="MG">{t('madagascar')}</option></select></F>
          <F label={t('acc_opening')}><input className="input num" name="opening_balance" inputMode="decimal" defaultValue="0" /></F>
          <F label={t('opening_date')}><input className="input" type="date" name="opening_date" /></F>
          <input type="hidden" name="active" value="true" />
          <SaveBar label={t('add')} />
        </form>
      </Panel>
    </div>
  );
}
