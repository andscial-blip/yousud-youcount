import { can, requireMe, RESP, type Role } from '@/lib/session';
import { Empty, ErrorNote, PageHead, Panel, SearchBox } from '@/components/Page';
import { EditRow, F, Flash, Hidden, SaveBar } from '@/components/Admin';
import { saveCounterpartyPrivate, saveRow } from '../admin/actions';

export const dynamic = 'force-dynamic';

const WRITERS: Role[] = ['super_admin', 'admin', 'responsabile', 'operator'];
const KINDS = ['supplier', 'donor', 'beneficiary', 'staff', 'member', 'other'] as const;
type Cp = { id: string; name: string; kind: (typeof KINDS)[number]; vat_number: string | null; country: string | null; active: boolean };
type Priv = { counterparty_id: string; tax_code: string | null; email: string | null; phone: string | null;
              address: string | null; iban: string | null; notes: string | null };

// Il nome è visibile a tutti; codice fiscale, contatti e IBAN stanno in una tabella separata
// che vedono e modificano solo responsabili e amministratori.
export default async function Counterparties({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; q?: string }> }) {
  const { ok, err, q: q0 = '' } = await searchParams;
  const term = q0.trim().slice(0, 60).toLowerCase();
  const { supabase, me, t } = await requireMe();
  const resp = can(me, RESP);
  const [{ data: all, error }, { data: priv }] = await Promise.all([
    supabase.from('counterparties').select('id, name, kind, vat_number, country, active').order('name').limit(1000).returns<Cp[]>(),
    resp ? supabase.from('counterparty_private').select('counterparty_id, tax_code, email, phone, address, iban, notes').returns<Priv[]>()
         : Promise.resolve({ data: [] as Priv[] }),
  ]);
  const data = (all ?? []).filter((c) => !term || [c.name, c.vat_number, c.country].some((x) => x?.toLowerCase().includes(term)));
  const pv = new Map((priv ?? []).map((p) => [p.counterparty_id, p]));
  const kindSel = (v: string) => (
    <select className="input" name="kind" defaultValue={v}>{KINDS.map((k) => <option key={k} value={k}>{t(`cp_kind_${k}`)}</option>)}</select>
  );
  const summary = (c: Cp) => (<>
    <b className="grow">{c.name}</b><span className="muted">{t(`cp_kind_${c.kind}`)}</span>
    {c.vat_number && <span className="num muted">{c.vat_number}</span>}
    {!c.active && <span className="chip">{t('inactive')}</span>}
  </>);
  return (
    <div className="stack">
      <PageHead title={t('nav_counterparties')} />
      {(all ?? []).length > 8 && <SearchBox action="/controparti" value={q0} placeholder={t('search_cp')} clearLabel={t('search_clear')} />}
      {resp && <p className="muted" style={{ margin: 0 }}>{t('admin_readonly')}</p>}
      <Flash ok={ok} err={err} okText={t('saved')} />
      <ErrorNote prefix={t('error_load')} error={error} />
      <Panel>
        {data.length === 0 ? <Empty text={term ? t('empty_search_generic') : t('cp_empty')} /> : data.map((c) => resp ? (
          <EditRow key={c.id} inactive={!c.active} summary={summary(c)}>
            <form action={saveRow} className="fgrid">
              <Hidden v={{ _table: 'counterparties', id: c.id }} />
              <F label={t('name')}><input className="input" name="name" defaultValue={c.name} required maxLength={200} /></F>
              <F label={t('type')}>{kindSel(c.kind)}</F>
              <F label={t('vat')}><input className="input" name="vat_number" defaultValue={c.vat_number ?? ''} /></F>
              <F label={t('country')}><input className="input" name="country" defaultValue={c.country ?? ''} maxLength={2} placeholder="IT, MG…" /></F>
              <label className="check"><input type="checkbox" name="active" defaultChecked={c.active} /> {t('active')}</label>
              <SaveBar label={t('save')} />
            </form>
            <h3 style={{ margin: '18px 0 10px', fontSize: 14 }}>{t('cp_private')}</h3>
            <form action={saveCounterpartyPrivate} className="fgrid">
              <Hidden v={{ counterparty_id: c.id }} />
              <F label={t('tax_code')}><input className="input" name="tax_code" defaultValue={pv.get(c.id)?.tax_code ?? ''} /></F>
              <F label={t('iban')}><input className="input num" name="iban" defaultValue={pv.get(c.id)?.iban ?? ''} /></F>
              <F label={t('email')}><input className="input" type="email" name="email" defaultValue={pv.get(c.id)?.email ?? ''} /></F>
              <F label={t('phone')}><input className="input" name="phone" defaultValue={pv.get(c.id)?.phone ?? ''} /></F>
              <F label={t('address')} wide><input className="input" name="address" defaultValue={pv.get(c.id)?.address ?? ''} /></F>
              <F label={t('f_notes')} wide><input className="input" name="notes" defaultValue={pv.get(c.id)?.notes ?? ''} /></F>
              <SaveBar label={t('save')} />
            </form>
          </EditRow>
        ) : (
          <div key={c.id} className={`erow${c.active ? '' : ' off'}`}><div className="erow-s" style={{ padding: '12px 16px' }}>{summary(c)}</div></div>
        ))}
      </Panel>
      {can(me, WRITERS) && (
        <Panel title={t('cp_add')} pad>
          <form action={saveRow} className="fgrid">
            <Hidden v={{ _table: 'counterparties', active: 'true' }} />
            <F label={t('name')}><input className="input" name="name" required maxLength={200} /></F>
            <F label={t('type')}>{kindSel('supplier')}</F>
            <F label={t('vat')}><input className="input" name="vat_number" /></F>
            <F label={t('country')}><input className="input" name="country" maxLength={2} placeholder="IT, MG…" /></F>
            <SaveBar label={t('add')} />
          </form>
        </Panel>
      )}
    </div>
  );
}
