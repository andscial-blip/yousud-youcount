'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Dict } from '@/lib/i18n';
import type { RefData } from '@/lib/movement-ref';
import { parseAmount } from '@/lib/amount';
import { ScanEditor, type ScanResult } from './ScanEditor';

type Kind = 'expense' | 'income' | 'transfer';
export type Initial = {
  id: string; version: number; status: 'draft' | 'recorded' | 'verified'; kind: Kind; op_date: string;
  doc_date: string | null; description: string; amount: string; currency: string; fx_rate: string | null;
  account_id: string; to_account_id: string | null; to_amount: string | null; category_id: string | null;
  project_id: string | null; grant_id?: string | null; counterparty_id: string | null; payment_method_id: string | null; notes: string | null;
  no_doc_reason: string | null; docs: { id: string; label: string }[];
};
type Doc = { key: string; label: string; state: 'uploading' | 'ok' | 'dup' | 'err'; id?: string };
type AiKey = 'amount' | 'opDate' | 'docDate' | 'description' | 'category' | 'cp' | 'method';
type AiMark = { status: string; confidence: number; source: string | null; confirmed: boolean };
type AiField = { value: string | number | null; source: string | null; confidence: number; status: string; note?: string | null };
type AiResult = { fields: Record<string, AiField>; checks: { code: string; ok: boolean; message: string }[] };
const METHOD_HINT: Record<string, RegExp> = {
  cash: /contant|esp[eè]ce|cash/i, card: /carta|carte|card|bancomat/i, transfer: /bonifico|virement|transfer/i,
  mobile_money: /mobile|mvola|orange|airtel/i, cheque: /assegno|ch[eè]que/i,
};
type Dup = { id: string; ref: string | null; op_date: string; amount: string; currency: string; description: string };

async function sha256(file: File) {
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number, cur: string) => new Intl.NumberFormat('it-IT', {
  style: 'currency', currency: cur, minimumFractionDigits: cur === 'MGA' ? 0 : 2, maximumFractionDigits: cur === 'MGA' ? 0 : 2,
  useGrouping: 'always',
} as Intl.NumberFormatOptions).format(n);

export function MovementForm({ refData: R, t, initial }: { refData: RefData; t: Dict; initial?: Initial }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const clientUuid = useRef<string>(initial ? '' : crypto.randomUUID());

  const [kind, setKind] = useState<Kind>(initial?.kind ?? 'expense');
  const [opDate, setOpDate] = useState(initial?.op_date ?? today());
  const [docDate, setDocDate] = useState(initial?.doc_date ?? '');
  const [amountTxt, setAmountTxt] = useState(initial ? String(Number(initial.amount)).replace('.', ',') : '');
  const [accountId, setAccountId] = useState(initial?.account_id ?? '');
  const [toAccountId, setToAccountId] = useState(initial?.to_account_id ?? '');
  const [toAmountTxt, setToAmountTxt] = useState(initial?.to_amount ? String(Number(initial.to_amount)).replace('.', ',') : '');
  const [rateTxt, setRateTxt] = useState(initial?.fx_rate ? String(Number(initial.fx_rate)).replace('.', ',') : '');
  const [rateTouched, setRateTouched] = useState(Boolean(initial?.fx_rate));
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '');
  const [projectId, setProjectId] = useState(initial?.project_id ?? '');
  const [grantId, setGrantId] = useState(initial?.grant_id ?? '');
  const [cpId, setCpId] = useState(initial?.counterparty_id ?? '');
  const [cpNew, setCpNew] = useState('');
  const [methodId, setMethodId] = useState(initial?.payment_method_id ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [noDoc, setNoDoc] = useState(Boolean(initial?.no_doc_reason));
  const [noDocReason, setNoDocReason] = useState(initial?.no_doc_reason ?? '');
  const [docs, setDocs] = useState<Doc[]>((initial?.docs ?? []).map((d) => ({ key: d.id, label: d.label, state: 'ok', id: d.id })));
  const [dups, setDups] = useState<Dup[]>([]);
  const [scanQueue, setScanQueue] = useState<File[]>([]);
  const [ai, setAi] = useState<Partial<Record<AiKey, AiMark>>>({});
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [aiChecks, setAiChecks] = useState<AiResult['checks']>([]);
  const [aiCurrency, setAiCurrency] = useState<string | null>(null);
  const confirm = (k: AiKey) => setAi((a) => (a[k] && !a[k]!.confirmed ? { ...a, [k]: { ...a[k]!, confirmed: true } } : a));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const account = R.accounts.find((a) => a.id === accountId);
  const toAccount = R.accounts.find((a) => a.id === toAccountId);
  const currency = account?.currency ?? 'EUR';
  const amount = parseAmount(amountTxt);
  const rate = parseAmount(rateTxt);
  const dir = kind === 'income' ? 'in' : 'out';
  const cats = R.categories.filter((c) => c.direction === dir);
  const groups = [...new Set(cats.map((c) => c.group))];
  const grants = R.grants.filter((g) => !g.project_id || g.project_id === projectId);

  // tasso proposto: quello del mese della data, o l'ultimo precedente
  const suggested = useMemo(() => {
    const [y, m] = opDate.split('-').map(Number);
    const prev = R.rates.filter((r) => r.year < y || (r.year === y && r.month <= m));
    return prev.length ? prev[prev.length - 1].rate : null;
  }, [opDate, R.rates]);
  useEffect(() => {
    if (!rateTouched && suggested) setRateTxt(String(suggested).replace('.', ','));
  }, [suggested, rateTouched]);

  // giroconto nella stessa valuta: l'importo arrivato è lo stesso
  useEffect(() => {
    if (kind === 'transfer' && account && toAccount && account.currency === toAccount.currency) setToAmountTxt(amountTxt);
  }, [kind, amountTxt, account, toAccount]);

  // possibili doppioni (stesso importo e valuta, ±3 giorni, stesso conto o controparte)
  useEffect(() => {
    if (!amount || !accountId || !opDate) { setDups([]); return; }
    const h = setTimeout(async () => {
      const { data } = await supabase.rpc('find_duplicates', {
        p: { amount, currency, op_date: opDate, account_id: accountId, counterparty_id: cpId || null, exclude_id: initial?.id ?? null },
      });
      setDups((data ?? []) as Dup[]);
    }, 500);
    return () => clearTimeout(h);
  }, [amount, currency, opDate, accountId, cpId, initial?.id, supabase]);

  // immagini → ritaglio e miglioramento prima del caricamento; PDF → caricati così come sono
  function addFiles(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files);
    list.filter((f) => !f.type.startsWith('image/')).forEach((f) => upload({ original: f }));
    setScanQueue((q) => [...q, ...list.filter((f) => f.type.startsWith('image/'))]);
  }

  async function upload(r: ScanResult) {
    const file = r.original;
    const key = crypto.randomUUID();
    setDocs((d) => [...d, { key, label: file.name, state: 'uploading' }]);
    try {
      const hash = await sha256(file);
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
      const base = `${R.orgId}/${opDate.slice(0, 4)}/${key}`;
      const paths = { original: `${base}.${ext}`, enhanced: r.enhanced ? `${base}-scan.jpg` : null, pdf: r.pdf ? `${base}.pdf` : null };
      const { data: found } = await supabase.from('documents').select('id').eq('sha256', hash).maybeSingle();
      if (!found) {
        const put = async (path: string, body: Blob, type: string) => {
          const up = await supabase.storage.from('documents').upload(path, body, { contentType: type, upsert: false });
          if (up.error) throw up.error;
        };
        await put(paths.original, file, file.type || 'application/octet-stream');
        if (r.enhanced && paths.enhanced) await put(paths.enhanced, r.enhanced, 'image/jpeg');
        if (r.pdf && paths.pdf) await put(paths.pdf, r.pdf, 'application/pdf');
      }
      const { data, error } = await supabase.rpc('register_document', {
        p: { client_uuid: key, sha256: hash, original_path: paths.original, enhanced_path: paths.enhanced, pdf_path: paths.pdf,
             mime: file.type || 'application/octet-stream', file_name: file.name, size_bytes: file.size, doc_date: docDate || null },
      });
      if (error) throw error;
      setDocs((d) => d.map((x) => (x.key === key ? { ...x, id: data.id, state: data.outcome === 'duplicate_file' ? 'dup' : 'ok' } : x)));
    } catch {
      setDocs((d) => d.map((x) => (x.key === key ? { ...x, state: 'err' } : x)));
    }
  }

  // lettura IA: i valori proposti riempiono i campi e restano "da confermare" finché l'utente non li conferma o li corregge
  async function readWithAi(docId: string) {
    setAiBusy(docId);
    setAiMsg(null);
    try {
      const res = await fetch('/api/v1/extract', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document_id: docId }) });
      const body = await res.json();
      if (!res.ok) {
        setAiMsg(body.error === 'ai_disabled' ? t.ai_disabled : body.error === 'ai_not_configured' ? t.ai_not_configured : t.ai_err);
        return;
      }
      const f = (body as AiResult).fields;
      const marks: Partial<Record<AiKey, AiMark>> = {};
      const mark = (k: AiKey, x: AiField) => { marks[k] = { status: x.status, confidence: x.confidence, source: x.source, confirmed: false }; };
      const usable = (x?: AiField) => x && x.value !== null && x.value !== '' && x.status !== 'missing';
      if (usable(f.total)) {
        const n = typeof f.total.value === 'number' ? f.total.value : parseAmount(String(f.total.value));
        if (n) { setAmountTxt(String(n).replace('.', ',')); mark('amount', f.total); }
      }
      setAiCurrency(usable(f.currency) ? String(f.currency.value) : null);
      if (usable(f.doc_date) && /^\d{4}-\d{2}-\d{2}$/.test(String(f.doc_date.value))) {
        setDocDate(String(f.doc_date.value)); mark('docDate', f.doc_date);
        setOpDate(String(f.doc_date.value)); mark('opDate', { ...f.doc_date, status: 'inferred' });
      }
      if (usable(f.description)) { setDescription(String(f.description.value).slice(0, 500)); mark('description', f.description); }
      if (usable(f.category_code)) {
        const c = R.categories.find((x) => x.code === String(f.category_code.value) && x.direction === (kind === 'income' ? 'in' : 'out'));
        if (c) { setCategoryId(c.id); mark('category', f.category_code); }
      }
      if (usable(f.supplier_name)) {
        const name = String(f.supplier_name.value);
        const hit = R.counterparties.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (hit) setCpId(hit.id); else { setCpId('__new'); setCpNew(name); }
        mark('cp', f.supplier_name);
      }
      if (usable(f.payment_method)) {
        const re = METHOD_HINT[String(f.payment_method.value)];
        const m = re && R.methods.find((x) => re.test(x.code) || re.test(x.name));
        if (m) { setMethodId(m.id); mark('method', f.payment_method); }
      }
      setAi(marks);
      setAiChecks((body as AiResult).checks ?? []);
    } catch {
      setAiMsg(t.ai_err);
    } finally {
      setAiBusy(null);
    }
  }

  const missing = {
    amount: !amount, account: !accountId, toAccount: kind === 'transfer' && !toAccountId,
    toAmount: kind === 'transfer' && !parseAmount(toAmountTxt),
    category: kind !== 'transfer' && !categoryId, project: kind === 'expense' && !projectId,
    rate: currency === 'MGA' && !rate, noDocReason: noDoc && noDocReason.trim().length < 5,
  };

  function errorText(msg: string) {
    const code = msg.split(':')[0].trim();
    if (msg.includes('movements_expense_project')) return t.err_expense_project;
    const k = `err_${code}` as keyof Dict;
    return k in t ? t[k] : `${t.err_generic}: ${msg}`;
  }

  async function save(status: 'draft' | 'recorded') {
    setTouched(true);
    setError(null);
    const needed = status === 'recorded'
      ? Object.values(missing).some(Boolean)
      : missing.amount || missing.account || (kind === 'transfer' && missing.toAccount);
    if (needed) return;
    if (docs.some((d) => d.state === 'uploading')) return;
    if (status === 'recorded' && Object.values(ai).some((m) => m && !m.confirmed)) { setError(t.ai_pending); return; }
    setBusy(true);
    try {
      let counterparty = cpId || null;
      if (cpId === '__new' && cpNew.trim()) {
        const { data, error } = await supabase.from('counterparties')
          .insert({ org_id: R.orgId, name: cpNew.trim(), kind: kind === 'income' ? 'donor' : 'supplier', created_by: R.userId })
          .select('id').single();
        if (error) throw error;
        counterparty = data.id;
      } else if (cpId === '__new') counterparty = null;
      const p: Record<string, unknown> = {
        kind, op_date: opDate, doc_date: docDate || null, description: description.trim(), amount,
        currency, fx_rate: currency === 'MGA' ? rate : null, account_id: accountId,
        to_account_id: kind === 'transfer' ? toAccountId : null,
        to_amount: kind === 'transfer' ? parseAmount(toAmountTxt) : null,
        category_id: kind === 'transfer' ? null : categoryId || null,
        project_id: kind === 'transfer' ? null : projectId || null,
        grant_id: kind === 'transfer' ? null : grantId || null,
        counterparty_id: counterparty, payment_method_id: methodId || null, notes: notes.trim() || null,
        no_doc_reason: noDoc ? noDocReason.trim() : null, status,
        document_ids: docs.filter((d) => d.id).map((d) => d.id), device_id: 'web',
        ai_extracted: Object.keys(ai).length > 0 || undefined,
      };
      if (initial) Object.assign(p, { id: initial.id, expected_version: initial.version, op_uuid: crypto.randomUUID() });
      else p.client_uuid = clientUuid.current;
      const { data, error } = await supabase.rpc('save_movement', { p });
      if (error) throw error;
      if (data.outcome === 'conflict') { setError(t.f_conflict); setBusy(false); return; }
      router.push(`/movimenti/${data.id}`);
      router.refresh();
    } catch (e) {
      setError(errorText((e as { message?: string }).message ?? String(e)));
      setBusy(false);
    }
  }

  const req = (bad: boolean) => (touched && bad ? <span className="ferr">{t.f_required}</span> : null);
  const aiCls = (k: AiKey) => (ai[k] ? (ai[k]!.confirmed ? 'field ai-field ok' : 'field ai-field') : 'field');
  const aiTag = (k: AiKey) => {
    const m = ai[k];
    if (!m) return null;
    const st = m.status === 'ambiguous' ? 'err' : m.status === 'inferred' ? 'warn' : 'ok';
    return (
      <span className="ai-tag">
        <span className={`chip ${m.confirmed ? 'ok' : st}`}>{m.confirmed ? t.ai_confirmed : `${t.ai_proposed} · ${t[`ai_status_${m.status}` as keyof Dict] ?? m.status}`}</span>
        {m.source && <span>{t.ai_source}: <q>{m.source}</q></span>}
        {!m.confirmed && <button type="button" className="btn" onClick={() => confirm(k)}>{t.ai_confirm}</button>}
      </span>
    );
  };
  const accOptions = (exclude?: string) => (['IT', 'MG'] as const).map((loc) => (
    <optgroup key={loc} label={loc === 'IT' ? t.italy : t.madagascar}>
      {R.accounts.filter((a) => a.location === loc && a.id !== exclude).map((a) => (
        <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>
      ))}
    </optgroup>
  ));
  const recordedLocked = initial && initial.status !== 'draft';

  return (
    <form className="stack mform" onSubmit={(e) => { e.preventDefault(); save('recorded'); }} noValidate>
      {scanQueue[0] && (
        <ScanEditor key={scanQueue[0].name + scanQueue.length} file={scanQueue[0]} t={t}
                    onDone={(r) => { setScanQueue((q) => q.slice(1)); upload(r); }}
                    onCancel={() => setScanQueue((q) => q.slice(1))} />
      )}
      <div className="seg kinds" role="group" aria-label={t.f_kind}>
        {(['expense', 'income', 'transfer'] as const).map((k) => (
          <button type="button" key={k} aria-pressed={kind === k} disabled={Boolean(recordedLocked)}
                  onClick={() => { setKind(k); setCategoryId(''); }}>{t[`k_${k}`]}</button>
        ))}
      </div>

      <section className="panel"><div className="panel-b fgrid">
        <div className={aiCls('amount')}>
          <label htmlFor="amount">{t.f_amount}{account ? ` (${currency})` : ''}</label>
          <input className="input big num" id="amount" inputMode="decimal" autoComplete="off" value={amountTxt}
                 onChange={(e) => { setAmountTxt(e.target.value); confirm('amount'); }} placeholder="0,00" />
          {aiTag('amount')}
          {aiCurrency && account && aiCurrency !== currency && <span className="ferr">{t.ai_currency_diff} {aiCurrency}</span>}
          {req(missing.amount)}
          {amount && currency === 'MGA' && rate ? <span className="hint">{t.f_eur_equiv}: {fmt(amount / rate, 'EUR')}</span> : null}
        </div>
        <div className={aiCls('opDate')}>
          <label htmlFor="opdate">{t.f_op_date}</label>
          <input className="input" id="opdate" type="date" value={opDate} onChange={(e) => { setOpDate(e.target.value); confirm('opDate'); }} />
          {aiTag('opDate')}
        </div>
        <div className="field">
          <label htmlFor="account">{kind === 'transfer' ? t.f_from_account : t.f_account}</label>
          <select className="input" id="account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">{t.f_choose}</option>{accOptions()}
          </select>
          {req(missing.account)}
        </div>
        {currency === 'MGA' && (
          <div className="field">
            <label htmlFor="rate">{t.f_rate}</label>
            <input className="input num" id="rate" inputMode="decimal" value={rateTxt}
                   onChange={(e) => { setRateTxt(e.target.value); setRateTouched(true); }} />
            <span className="hint">{suggested ? (!rateTouched || rate === suggested ? t.f_rate_auto : '') : t.f_rate_missing}</span>
            {req(missing.rate)}
          </div>
        )}
        {kind === 'transfer' && (<>
          <div className="field">
            <label htmlFor="toaccount">{t.f_to_account}</label>
            <select className="input" id="toaccount" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              <option value="">{t.f_choose}</option>{accOptions(accountId)}
            </select>
            {req(missing.toAccount)}
          </div>
          <div className="field">
            <label htmlFor="toamount">{t.f_to_amount}{toAccount ? ` (${toAccount.currency})` : ''}</label>
            <input className="input num" id="toamount" inputMode="decimal" value={toAmountTxt}
                   disabled={Boolean(account && toAccount && account.currency === toAccount.currency)}
                   onChange={(e) => setToAmountTxt(e.target.value)} />
            {req(missing.toAmount)}
          </div>
        </>)}
        {kind !== 'transfer' && (<>
          <div className={aiCls('category')}>
            <label htmlFor="category">{t.f_category}</label>
            <select className="input" id="category" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); confirm('category'); }}>
              <option value="">{t.f_choose}</option>
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {cats.filter((c) => c.group === g).map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
                </optgroup>
              ))}
            </select>
            {aiTag('category')}
            {req(missing.category)}
          </div>
          <div className="field">
            <label htmlFor="project">{t.f_project}</label>
            <select className="input" id="project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">{kind === 'income' ? t.f_cp_none : t.f_choose}</option>
              {R.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {kind === 'expense' && <span className="hint">{t.f_project_hint}</span>}
            {req(missing.project)}
          </div>
          {grants.length > 0 && (
            <div className="field">
              <label htmlFor="grant">{t.f_grant}</label>
              <select className="input" id="grant" value={grantId} onChange={(e) => setGrantId(e.target.value)}>
                <option value="">{t.f_cp_none}</option>
                {grants.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
          )}
          <div className={aiCls('cp')}>
            <label htmlFor="cp">{t.f_counterparty}</label>
            <select className="input" id="cp" value={cpId} onChange={(e) => { setCpId(e.target.value); confirm('cp'); }}>
              <option value="">{t.f_cp_none}</option>
              <option value="__new">{t.f_cp_new}</option>
              {R.counterparties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {cpId === '__new' && <input className="input" aria-label={t.f_cp_new_ph} placeholder={t.f_cp_new_ph}
                                        value={cpNew} onChange={(e) => { setCpNew(e.target.value); confirm('cp'); }} />}
            {aiTag('cp')}
          </div>
        </>)}
        <div className={aiCls('method')}>
          <label htmlFor="method">{t.f_method}</label>
          <select className="input" id="method" value={methodId} onChange={(e) => { setMethodId(e.target.value); confirm('method'); }}>
            <option value="">{t.f_choose}</option>
            {R.methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {aiTag('method')}
        </div>
        <div className={`${aiCls('description')} span2`}>
          <label htmlFor="desc">{t.f_description}</label>
          <input className="input" id="desc" maxLength={500} placeholder={t.f_description_ph} value={description}
                 onChange={(e) => { setDescription(e.target.value); confirm('description'); }} />
          {aiTag('description')}
        </div>
      </div></section>

      {kind !== 'transfer' && (
        <section className="panel"><div className="panel-h"><h2>{t.f_doc}</h2></div><div className="panel-b stack" style={{ gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label className="btn primary">{t.f_doc_photo}
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            </label>
            <label className="btn">{t.f_doc_file}
              <input type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            </label>
          </div>
          {docs.length > 0 && (
            <ul className="docs">
              {docs.map((d) => (
                <li key={d.key}>
                  <span>{d.label}</span>
                  <span className={`chip ${d.state === 'ok' ? 'ok' : d.state === 'err' ? 'err' : 'warn'}`}>
                    {d.state === 'uploading' ? t.f_doc_uploading : d.state === 'ok' ? t.f_doc_ok : d.state === 'dup' ? t.f_doc_dup : t.f_doc_err}
                  </span>
                  {R.aiEnabled && d.id && (d.state === 'ok' || d.state === 'dup') && (
                    <button type="button" className="btn primary" disabled={aiBusy !== null} onClick={() => readWithAi(d.id!)}>
                      {aiBusy === d.id ? t.ai_reading : t.ai_read}</button>
                  )}
                  {d.state !== 'uploading' && !initial?.docs.some((x) => x.id === d.id) && (
                    <button type="button" className="btn ghost" aria-label="×" onClick={() => setDocs((x) => x.filter((y) => y.key !== d.key))}>×</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {aiMsg && <div className="note err">{aiMsg}</div>}
          {Object.keys(ai).length > 0 && (
            <div className="note">
              <b>{t.ai_note}</b>
              {aiChecks.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {aiChecks.map((c) => <li key={c.code} style={{ color: c.ok ? 'var(--green)' : 'var(--red)' }}>{c.ok ? '✓' : '!'} {c.message}</li>)}
                </ul>
              )}
            </div>
          )}
          <label className="check"><input type="checkbox" checked={noDoc} onChange={(e) => setNoDoc(e.target.checked)} /> {t.f_no_doc}</label>
          {noDoc && (
            <div className="field">
              <label htmlFor="nodoc">{t.f_no_doc_reason}</label>
              <input className="input" id="nodoc" value={noDocReason} onChange={(e) => setNoDocReason(e.target.value)} />
              {req(missing.noDocReason)}
            </div>
          )}
          <div className={aiCls('docDate')}>
            <label htmlFor="docdate">{t.f_doc_date}</label>
            <input className="input" id="docdate" type="date" value={docDate} onChange={(e) => { setDocDate(e.target.value); confirm('docDate'); }} style={{ maxWidth: 220 }} />
            {aiTag('docDate')}
          </div>
        </div></section>
      )}

      <section className="panel"><div className="panel-b field">
        <label htmlFor="notes">{t.f_notes}</label>
        <textarea className="input" id="notes" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div></section>

      {dups.length > 0 && (
        <div className="note">
          <b>{t.f_dups_title}.</b> {t.f_dups_text}
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {dups.map((d) => (
              <li key={d.id}><a href={`/movimenti/${d.id}`} target="_blank" rel="noreferrer">
                {d.ref ?? '—'} · {d.op_date.split('-').reverse().join('/')} · {fmt(Number(d.amount), d.currency)} · {d.description}</a></li>
            ))}
          </ul>
        </div>
      )}
      {error && <div className="note err" role="alert">{error}</div>}

      <div className="factions">
        {(!initial || initial.status === 'draft') && (
          <button type="button" className="btn" disabled={busy} onClick={() => save('draft')}>{t.f_save_draft}</button>
        )}
        <button type="submit" className="btn primary" disabled={busy}>{busy ? t.f_saving : t.f_record}</button>
        <span className="hint" style={{ flex: '1 1 260px' }}>{t.f_record_hint}</span>
      </div>
    </form>
  );
}
