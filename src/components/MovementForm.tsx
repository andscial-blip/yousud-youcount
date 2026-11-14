'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Dict, Lang } from '@/lib/i18n';
import { money } from '@/lib/format';
import type { RefData } from '@/lib/movement-ref';
import { formatTyping, parseAmount } from '@/lib/amount';
import dynamic from 'next/dynamic';
import type { ScanResult } from './ScanEditor';
// l'editor della foto (con pdf-lib) si carica a parte: la pagina si apre prima; viene comunque scaricato
// poco dopo l'apertura, così il service worker lo conserva e funziona anche senza rete
const ScanEditor = dynamic(() => import('./ScanEditor').then((m) => m.ScanEditor), { ssr: false });
import { deviceId, isNetworkError, putOutbox, uploadDocument, type OutFile } from '@/lib/outbox';
import { Ico } from './Ui';

type Kind = 'expense' | 'income' | 'transfer';
export type Initial = {
  id: string; version: number; status: 'draft' | 'recorded' | 'verified'; kind: Kind; op_date: string;
  doc_date: string | null; description: string; amount: string; currency: string; fx_rate: string | null;
  account_id: string | null; to_account_id: string | null; to_amount: string | null; category_id: string | null;
  project_id: string | null; grant_id?: string | null; counterparty_id: string | null; payment_method_id: string | null; notes: string | null;
  no_doc_reason: string | null; docs: { id: string; label: string }[];
  paid_by?: string | null; reimb_status?: 'due' | 'paid' | null;
};
type Doc = { key: string; label: string; state: 'uploading' | 'ok' | 'dup' | 'err' | 'local'; id?: string; preview?: string };
type AiKey = 'amount' | 'opDate' | 'docDate' | 'description' | 'category' | 'cp' | 'method';
type AiMark = { status: string; confidence: number; source: string | null; confirmed: boolean };
type AiField = { value: string | number | null; source: string | null; confidence: number; status: string; note?: string | null };
type AiResult = { fields: Record<string, AiField>; checks: { code: string; ok: boolean; message: string }[] };
const METHOD_HINT: Record<string, RegExp> = {
  cash: /contant|esp[eè]ce|cash/i, card: /carta|carte|card|bancomat/i, transfer: /bonifico|virement|transfer/i,
  mobile_money: /mobile|mvola|orange|airtel/i, cheque: /assegno|ch[eè]que/i,
};
type Dup = { id: string; ref: string | null; op_date: string; amount: string; currency: string; description: string };

const today = () => new Date().toISOString().slice(0, 10);

// Precompilazione di un movimento nuovo (es. da una riga dell'estratto conto senza corrispondenza)
export type Prefill = { kind?: Kind; op_date?: string; amount?: number; account_id?: string; description?: string; own?: boolean };
type Props = { refData: RefData; t: Dict; initial?: Initial; prefill?: Prefill };

// Dopo un salvataggio senza rete il modulo riparte vuoto (nuova chiave) per il movimento successivo.
export function MovementForm(props: Props) {
  const [round, setRound] = useState(0);
  const [queued, setQueued] = useState(false);
  return (
    <>
      {queued && <div className="note ok" role="status" style={{ marginBottom: 14 }}>{props.t.q_saved}</div>}
      <Form key={round} {...props} prefill={round === 0 ? props.prefill : undefined} onQueued={() => { setQueued(true); setRound((r) => r + 1); window.scrollTo(0, 0); }} />
    </>
  );
}

function Form({ refData: R, t, initial, prefill: P, onQueued }: Props & { onQueued: () => void }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const clientUuid = useRef<string>(initial ? '' : crypto.randomUUID());
  // giustificativi rimasti sul telefono (senza rete): partono con il movimento dalla coda
  const localFiles = useRef(new Map<string, OutFile>());

  const [kind, setKind] = useState<Kind>(initial?.kind ?? P?.kind ?? 'expense');
  const [opDate, setOpDate] = useState(initial?.op_date ?? P?.op_date ?? today());
  const [docDate, setDocDate] = useState(initial?.doc_date ?? '');
  // importi scritti con il punto delle migliaia mentre si digita (5000 → 5.000)
  const fmt = (n: number | string) => formatTyping(String(n).replace('.', ',')).text;
  const typed = (e: React.ChangeEvent<HTMLInputElement>, set: (v: string) => void) => {
    const el = e.target; const r = formatTyping(el.value, el.selectionStart ?? el.value.length);
    set(r.text); requestAnimationFrame(() => { try { el.setSelectionRange(r.caret, r.caret); } catch { /* niente */ } });
  };
  const [amountTxt, setAmountTxt] = useState(initial ? fmt(Number(initial.amount))
    : P?.amount ? fmt(P.amount) : '');
  const [accountId, setAccountId] = useState(initial?.account_id ?? P?.account_id ?? '');
  // chi ha speso materialmente (non chi registra) e spesa pagata di tasca propria, da rimborsare
  const [paidBy, setPaidBy] = useState(initial ? (initial.paid_by ?? '') : R.userName);
  // come è stata pagata una spesa: dall'ente (conto), di tasca propria (da rimborsare) o con l'anticipo di una persona
  const advances = R.accounts.filter((a) => a.kind === 'advance');
  // dal portafoglio anticipi (conto anticipi già scelto) o da Rimborsi («di tasca propria») il modulo parte già impostato
  const [payMode, setPayMode] = useState<'org' | 'own' | 'adv'>(initial?.reimb_status === 'due' || (!initial && P?.own) ? 'own'
    : R.accounts.find((a) => a.id === (initial?.account_id ?? P?.account_id))?.kind === 'advance' ? 'adv' : 'org');
  const ownPocket = payMode === 'own';
  const choosePay = (m: 'org' | 'own' | 'adv') => {
    setPayMode(m);
    const isAdv = R.accounts.find((a) => a.id === accountId)?.kind === 'advance';
    if ((m === 'adv') !== isAdv) setAccountId('');
  };
  const [dueCurrency, setDueCurrency] = useState<'EUR' | 'MGA'>(initial?.currency === 'MGA' ? 'MGA' : 'EUR');
  const [toAccountId, setToAccountId] = useState(initial?.to_account_id ?? '');
  const [toAmountTxt, setToAmountTxt] = useState(initial?.to_amount ? fmt(Number(initial.to_amount)) : '');
  const [rateTxt, setRateTxt] = useState(initial?.fx_rate ? fmt(Number(initial.fx_rate)) : '');
  const [rateTouched, setRateTouched] = useState(Boolean(initial?.fx_rate));
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? '');
  const [projectId, setProjectId] = useState(initial?.project_id ?? '');
  const [grantId, setGrantId] = useState(initial?.grant_id ?? '');
  const [cpId, setCpId] = useState(initial?.counterparty_id ?? '');
  const [cpNew, setCpNew] = useState('');
  const [methodId, setMethodId] = useState(initial?.payment_method_id ?? '');
  const [description, setDescription] = useState(initial?.description ?? P?.description ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [noDoc, setNoDoc] = useState(Boolean(initial?.no_doc_reason));
  const [noDocReason, setNoDocReason] = useState(initial?.no_doc_reason ?? '');
  const [docs, setDocs] = useState<Doc[]>((initial?.docs ?? []).map((d) => ({ key: d.id, label: d.label, state: 'ok', id: d.id })));
  const [dups, setDups] = useState<Dup[]>([]);
  const [scanQueue, setScanQueue] = useState<File[]>([]);
  const [ai, setAi] = useState<Partial<Record<AiKey, AiMark>>>({});
  const autoRead = useRef(false);   // la lettura IA parte da sola una volta, al primo file
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
  const due = kind === 'expense' && ownPocket;
  const currency = due ? dueCurrency : account?.currency ?? 'EUR';
  const amount = parseAmount(amountTxt);
  const rate = parseAmount(rateTxt);
  const dir = kind === 'income' ? 'in' : 'out';
  const cats = R.categories.filter((c) => c.direction === dir);
  const groups = [...new Set(cats.map((c) => c.group))];
  const grants = R.grants.filter((g) => !g.project_id || g.project_id === projectId);

  // tasso proposto in automatico: quello salvato per il mese della data; altrimenti il più recente tra
  // l'ultimo tasso mensile precedente e l'ultimo tasso usato in un movimento in ariary
  const rateSugg = useMemo(() => {
    const [y, m] = opDate.split('-').map(Number);
    const prev = R.rates.filter((r) => r.year < y || (r.year === y && r.month <= m));
    const month = prev.length ? prev[prev.length - 1] : null;
    if (month && month.year === y && month.month === m) return { rate: month.rate, src: 'month' as const };
    const monthDate = month ? `${month.year}-${String(month.month).padStart(2, '0')}-01` : '';
    if (R.lastRate && R.lastRate.date >= monthDate) return { rate: R.lastRate.rate, src: 'last' as const };
    return month ? { rate: month.rate, src: 'month' as const } : null;
  }, [opDate, R.rates, R.lastRate]);
  const suggested = rateSugg?.rate ?? null;
  // scarica l'editor della foto appena la pagina è pronta (resta in cache per l'uso senza rete)
  useEffect(() => { const id = setTimeout(() => { void import('./ScanEditor'); }, 800); return () => clearTimeout(id); }, []);
  useEffect(() => {
    if (!rateTouched && suggested) setRateTxt(fmt(suggested));
  }, [suggested, rateTouched]);

  // giroconto nella stessa valuta: l'importo arrivato è lo stesso
  useEffect(() => {
    if (kind === 'transfer' && account && toAccount && account.currency === toAccount.currency) setToAmountTxt(amountTxt);
  }, [kind, amountTxt, account, toAccount]);

  // possibili doppioni (stesso importo e valuta, ±3 giorni, stesso conto o controparte)
  useEffect(() => {
    if (!amount || !accountId || !opDate || due) { setDups([]); return; }
    const h = setTimeout(async () => {
      const { data } = await supabase.rpc('find_duplicates', {
        p: { amount, currency, op_date: opDate, account_id: accountId, counterparty_id: cpId || null, exclude_id: initial?.id ?? null },
      });
      setDups((data ?? []) as Dup[]);
    }, 500);
    return () => clearTimeout(h);
  }, [amount, currency, opDate, accountId, cpId, initial?.id, supabase, due]);

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
    const keepLocal = () => {
      localFiles.current.set(key, { key, name: file.name, type: file.type || 'application/octet-stream', size: file.size,
        original: file, enhanced: r.enhanced ?? null, pdf: r.pdf ?? null });
      setDocs((d) => d.map((x) => (x.key === key ? { ...x, state: 'local' } : x)));
    };
    // anteprima dell'immagine (scansione migliorata se c'è): si controlla il giustificativo mentre si compilano i campi
    const img = r.enhanced ?? (file.type.startsWith('image/') ? file : null);
    const preview = img ? URL.createObjectURL(img) : undefined;
    setDocs((d) => [...d, { key, label: file.name, state: 'uploading', preview }]);
    // senza rete (solo per un movimento nuovo): il file resta sul telefono e parte con il movimento
    if (!navigator.onLine && !initial) { keepLocal(); return; }
    try {
      const data = await uploadDocument(supabase, { orgId: R.orgId, year: opDate.slice(0, 4), key, file, name: file.name,
        type: file.type, size: file.size, enhanced: r.enhanced, pdf: r.pdf, docDate: docDate || null });
      setDocs((d) => d.map((x) => (x.key === key ? { ...x, id: data.id, state: data.outcome === 'duplicate_file' ? 'dup' : 'ok' } : x)));
      if (R.aiEnabled && !initial && !autoRead.current) { autoRead.current = true; readWithAi(data.id, true); }
    } catch (e) {
      if (!initial && isNetworkError(e)) keepLocal();
      else setDocs((d) => d.map((x) => (x.key === key ? { ...x, state: 'err' } : x)));
    }
  }

  // lettura IA: i valori proposti riempiono i campi e restano "da confermare" finché l'utente non li conferma o li corregge
  // auto = lettura partita da sola: non sovrascrive ciò che l'utente ha già scritto
  async function readWithAi(docId: string, auto = false) {
    setAiBusy(docId);
    setAiMsg(null);
    try {
      const res = await fetch('/api/v1/extract', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document_id: docId }) });
      const body = await res.json().catch(() => ({ error: `http_${res.status}` }));
      if (!res.ok) {
        setAiMsg(body.error === 'ai_disabled' ? t.ai_disabled : body.error === 'ai_not_configured' ? t.ai_not_configured : `${t.ai_err} (${body.error ?? res.status})`);
        return;
      }
      const f = (body as AiResult).fields;
      const marks: Partial<Record<AiKey, AiMark>> = {};
      const mark = (k: AiKey, x: AiField) => { marks[k] = { status: x.status, confidence: x.confidence, source: x.source, confirmed: false }; };
      const usable = (x?: AiField) => x && x.value !== null && x.value !== '' && x.status !== 'missing';
      if (usable(f.total)) {
        const n = typeof f.total.value === 'number' ? f.total.value : parseAmount(String(f.total.value));
        if (n && !(auto && amountTxt)) { setAmountTxt(fmt(n)); mark('amount', f.total); }
      }
      setAiCurrency(usable(f.currency) ? String(f.currency.value) : null);
      if (usable(f.currency) && ['EUR', 'MGA'].includes(String(f.currency.value))) setDueCurrency(String(f.currency.value) as 'EUR' | 'MGA');
      if (usable(f.doc_date) && /^\d{4}-\d{2}-\d{2}$/.test(String(f.doc_date.value))) {
        setDocDate(String(f.doc_date.value)); mark('docDate', f.doc_date);
        setOpDate(String(f.doc_date.value)); mark('opDate', { ...f.doc_date, status: 'inferred' });
      }
      if (usable(f.description) && !(auto && description.trim())) { setDescription(String(f.description.value).slice(0, 500)); mark('description', f.description); }
      if (usable(f.category_code)) {
        const c = R.categories.find((x) => x.code === String(f.category_code.value) && x.direction === (kind === 'income' ? 'in' : 'out'));
        if (c && !(auto && categoryId)) { setCategoryId(c.id); mark('category', f.category_code); }
      }
      if (usable(f.supplier_name) && !(auto && cpId)) {
        const name = String(f.supplier_name.value);
        const hit = R.counterparties.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (hit) setCpId(hit.id); else { setCpId('__new'); setCpNew(name); }
        mark('cp', f.supplier_name);
      }
      if (usable(f.payment_method)) {
        const re = METHOD_HINT[String(f.payment_method.value)];
        const m = re && R.methods.find((x) => re.test(x.code) || re.test(x.name));
        if (m && !(auto && methodId)) { setMethodId(m.id); mark('method', f.payment_method); }
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
    amount: !amount, account: !accountId && !due, toAccount: kind === 'transfer' && !toAccountId,
    paidBy: kind === 'expense' && !paidBy.trim(),
    toAmount: kind === 'transfer' && !parseAmount(toAmountTxt),
    category: kind !== 'transfer' && !categoryId, project: kind === 'expense' && !projectId,
    rate: currency === 'MGA' && !rate, noDocReason: kind !== 'transfer' && noDoc && noDocReason.trim().length < 5,
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
    // spesa di tasca propria: resta "da rimborsare" (bozza senza conto) finché un responsabile non la rimborsa
    if (due) status = 'draft';
    if (needed) return;
    if (docs.some((d) => d.state === 'uploading')) return;
    if (initial && !navigator.onLine) { setError(t.q_edit_offline); return; }
    setBusy(true);
    const payload = (counterparty: string | null): Record<string, unknown> => ({
      kind, op_date: opDate, doc_date: docDate || null, description: description.trim(), amount,
      currency, fx_rate: currency === 'MGA' ? rate : null, account_id: due ? null : accountId,
      paid_by: kind === 'expense' ? paidBy.trim() || null : null,
      reimb_status: due ? 'due' : initial?.reimb_status === 'due' ? null : undefined,
      to_account_id: kind === 'transfer' ? toAccountId : null,
      to_amount: kind === 'transfer' ? parseAmount(toAmountTxt) : null,
      category_id: kind === 'transfer' ? null : categoryId || null,
      project_id: kind === 'transfer' ? null : projectId || null,
      grant_id: kind === 'transfer' ? null : grantId || null,
      counterparty_id: counterparty, payment_method_id: methodId || null, notes: notes.trim() || null,
      no_doc_reason: kind !== 'transfer' && noDoc ? noDocReason.trim() : null, status,
      document_ids: docs.filter((d) => d.id).map((d) => d.id), device_id: deviceId(),
      ai_extracted: Object.keys(ai).length > 0 || undefined,
    });
    // senza rete (o con giustificativi rimasti sul telefono): il movimento va nella coda e partirà da solo
    const queue = async () => {
      const files = docs.filter((d) => d.state === 'local').map((d) => localFiles.current.get(d.key)!).filter(Boolean);
      await putOutbox({
        id: clientUuid.current, createdAt: new Date().toISOString(), orgId: R.orgId, userId: R.userId,
        label: description.trim() || t[`k_${kind}` as keyof Dict], amount: amount ?? 0, currency, opDate,
        payload: payload(cpId && cpId !== '__new' ? cpId : null),
        cpNew: cpId === '__new' && cpNew.trim() ? { name: cpNew.trim(), kind: kind === 'income' ? 'donor' : 'supplier' } : null,
        docIds: docs.filter((d) => d.id).map((d) => d.id!), files, state: 'pending', attempts: 0,
      });
      onQueued();
    };
    if (!initial && (!navigator.onLine || docs.some((d) => d.state === 'local'))) {
      try { await queue(); } catch (e) { setError(errorText(String((e as Error)?.message ?? e))); setBusy(false); }
      return;
    }
    try {
      let counterparty = cpId || null;
      if (cpId === '__new' && cpNew.trim()) {
        const { data, error } = await supabase.from('counterparties')
          .insert({ org_id: R.orgId, name: cpNew.trim(), kind: kind === 'income' ? 'donor' : 'supplier', created_by: R.userId })
          .select('id').single();
        if (error) throw error;
        counterparty = data.id;
      } else if (cpId === '__new') counterparty = null;
      const p = payload(counterparty);
      if (initial) Object.assign(p, { id: initial.id, expected_version: initial.version, op_uuid: crypto.randomUUID() });
      else p.client_uuid = clientUuid.current;
      const { data, error } = await supabase.rpc('save_movement', { p });
      if (error) throw error;
      if (data.outcome === 'conflict') { setError(t.f_conflict); setBusy(false); return; }
      router.push(`/movimenti/${data.id}`);
      router.refresh();
    } catch (e) {
      // la rete è caduta durante l'invio: il movimento nuovo va nella coda invece di andare perso
      if (!initial && isNetworkError(e)) { try { await queue(); return; } catch { /* sotto: errore mostrato */ } }
      setError(errorText((e as { message?: string }).message ?? String(e)));
      setBusy(false);
    }
  }

  const req = (bad: boolean) => (touched && bad ? <span className="ferr">{t.f_required}</span> : null);
  // campi compilati dall'IA: chi registra li conferma tutti insieme; in giallo solo quelli incerti.
  // Un campo corretto a mano perde l'etichetta (confirmed = modificato dall'utente).
  const uncertain = (m?: AiMark) => Boolean(m && !m.confirmed && m.status !== 'present');
  const aiCls = (k: AiKey) => (ai[k] && !ai[k]!.confirmed ? (uncertain(ai[k]) ? 'field ai-field' : 'field ai-field ok') : 'field');
  const aiTag = (k: AiKey) => {
    const m = ai[k];
    if (!m || m.confirmed) return null;
    return (
      <span className="ai-tag">
        <span className={`chip ${uncertain(m) ? 'warn' : 'ok'}`}>{uncertain(m) ? `${t.ai_proposed} · ${t.ai_check}` : t.ai_proposed}</span>
        {uncertain(m) && m.source && <span>{t.ai_source}: <q>{m.source}</q></span>}
      </span>
    );
  };
  const advMode = kind === 'expense' && payMode === 'adv';
  // gli anticipi non si scelgono come conto di una spesa dell'ente o di un'entrata (solo con «Con l'anticipo» o nei giroconti)
  const accOptions = (exclude?: string, noAdvance = false) => (['IT', 'MG'] as const).map((loc) => (
    <optgroup key={loc} label={loc === 'IT' ? t.italy : t.madagascar}>
      {R.accounts.filter((a) => a.location === loc && a.id !== exclude && !(noAdvance && a.kind === 'advance')).map((a) => (
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
      <section className="panel doc-first"><div className="panel-h"><h2>{t.f_doc}</h2>{kind === 'transfer' && <span className="muted" style={{ fontSize: 13 }}>{t.f_doc_optional}</span>}</div><div className="panel-b stack" style={{ gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="btn primary big-touch"><Ico name="camera" size={20} />{t.f_doc_photo}
          <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </label>
        <label className="btn big-touch"><Ico name="upload" />{t.f_doc_file}
          <input type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </label>
      </div>
      {R.aiEnabled && docs.some((d) => d.state === 'local') && <div className="note">{t.q_no_ai}</div>}
      {docs.find((d) => d.preview) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="doc-prev" src={docs.find((d) => d.preview)!.preview} alt={t.f_doc} />
      )}
      {docs.length > 0 && (
        <ul className="docs">
          {docs.map((d) => (
            <li key={d.key}>
              <span>{d.label}</span>
              <span className={`chip ${d.state === 'ok' ? 'ok' : d.state === 'err' ? 'err' : 'warn'}`}>
                {d.state === 'uploading' ? t.f_doc_uploading : d.state === 'ok' ? t.f_doc_ok : d.state === 'dup' ? t.f_doc_dup : d.state === 'local' ? t.f_doc_local : t.f_doc_err}
              </span>
              {R.aiEnabled && d.id && (d.state === 'ok' || d.state === 'dup') && (
                <button type="button" className="btn primary" disabled={aiBusy !== null} onClick={() => readWithAi(d.id!)}>
                  {aiBusy === d.id ? t.ai_reading : t.ai_read}</button>
              )}
              {d.state !== 'uploading' && !initial?.docs.some((x) => x.id === d.id) && (
                <button type="button" className="btn ghost" aria-label={t.remove_doc} title={t.remove_doc} onClick={() => { localFiles.current.delete(d.key); setDocs((x) => x.filter((y) => y.key !== d.key)); }}><Ico name="close" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {aiMsg && <div className="note err">{aiMsg}</div>}
      {Object.keys(ai).length > 0 && (
        <div className="note">
          <b>{t.ai_note}</b>
          {aiChecks.some((c) => !c.ok) && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {aiChecks.filter((c) => !c.ok).map((c) => <li key={c.code} style={{ color: 'var(--red)' }}>! {c.message}</li>)}
            </ul>
          )}
        </div>
      )}
      {kind !== 'transfer' && <label className="check"><input type="checkbox" checked={noDoc} onChange={(e) => setNoDoc(e.target.checked)} /> {t.f_no_doc}</label>}
      {kind !== 'transfer' && noDoc && (
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

      <div className="seg kinds" role="group" aria-label={t.f_kind}>
        {(['expense', 'income', 'transfer'] as const).map((k) => (
          <button type="button" key={k} aria-pressed={kind === k} disabled={Boolean(recordedLocked)}
                  onClick={() => { setKind(k); setCategoryId(''); if (k === 'income' && R.accounts.find((a) => a.id === accountId)?.kind === 'advance') setAccountId(''); }}><Ico name={k} size={18} />{t[`k_${k}`]}</button>
        ))}
      </div>

      <section className="panel"><div className="panel-b fgrid">
        <div className={aiCls('amount')}>
          <label htmlFor="amount">{t.f_amount}{account || due ? ` (${currency})` : ''}</label>
          <input className="input big num" id="amount" inputMode="decimal" autoComplete="off" value={amountTxt}
                 onChange={(e) => { typed(e, setAmountTxt); confirm('amount'); }} placeholder="0,00" />
          {aiTag('amount')}
          {aiCurrency && account && aiCurrency !== currency && <span className="ferr">{t.ai_currency_diff} {aiCurrency}</span>}
          {req(missing.amount)}
          {amount ? <span className="hint amt-echo">{t.f_amount_read}: <b>{money(amount, currency || 'EUR', t.lang_code as Lang)}</b>
            {currency === 'MGA' && rate ? <> · {t.f_eur_equiv}: {money(amount / rate, 'EUR', t.lang_code as Lang)}</> : null}
            {currency === 'MGA' && amount % 1 ? <> · {t.f_mga_round}</> : null}</span> : null}
        </div>
        <div className={aiCls('opDate')}>
          <label htmlFor="opdate">{t.f_op_date}</label>
          <input className="input" id="opdate" type="date" value={opDate} onChange={(e) => { setOpDate(e.target.value); confirm('opDate'); }} />
          {aiTag('opDate')}
        </div>
        {kind === 'expense' && (<>
          <div className="field">
            <label htmlFor="paidby">{t.f_paid_by}</label>
            <input className="input" id="paidby" list="payers" maxLength={120} value={paidBy} onChange={(e) => setPaidBy(e.target.value)} />
            <datalist id="payers">{R.payers.map((n) => <option key={n} value={n} />)}</datalist>
            <span className="hint">{t.f_paid_by_hint}</span>
            {req(missing.paidBy)}
          </div>
          <div className="field">
            <span className="flabel" id="howpaid">{t.f_how_paid}</span>
            <div className="seg stackable" role="radiogroup" aria-labelledby="howpaid">
              <button type="button" role="radio" aria-checked={payMode === 'org'} disabled={initial?.reimb_status === 'paid'} onClick={() => choosePay('org')}>{t.f_paid_org}</button>
              <button type="button" role="radio" aria-checked={ownPocket} disabled={Boolean(initial && initial.status !== 'draft')} onClick={() => choosePay('own')}>{t.f_paid_own}</button>
              {advances.length > 0 && (
                <button type="button" role="radio" aria-checked={payMode === 'adv'} disabled={initial?.reimb_status === 'paid'} onClick={() => choosePay('adv')}>{t.f_paid_adv}</button>
              )}
            </div>
            {due && <span className="hint">{t.f_due_hint}</span>}
            {payMode === 'adv' && kind === 'expense' && <span className="hint">{t.f_adv_hint}</span>}
          </div>
        </>)}
        {due ? (
          <div className="field">
            <span className="flabel" id="duecur">{t.f_currency}</span>
            <div className="seg" role="radiogroup" aria-labelledby="duecur">
              {(['EUR', 'MGA'] as const).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={dueCurrency === c} onClick={() => setDueCurrency(c)}>{c}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="account">{kind === 'transfer' ? t.f_from_account : advMode ? t.f_adv_account : t.f_account}</label>
            <select className="input" id="account" value={accountId ?? ''} onChange={(e) => {
              setAccountId(e.target.value);
              const h = R.accounts.find((a) => a.id === e.target.value)?.holder;
              if (advMode && h) setPaidBy(h);
            }}>
              <option value="">{t.f_choose}</option>
              {advMode ? advances.map((a) => <option key={a.id} value={a.id}>{a.holder ?? a.name} · {a.currency}</option>) : accOptions(undefined, kind !== 'transfer')}
            </select>
            {req(missing.account)}
          </div>
        )}
        {currency === 'MGA' && (
          <div className="field">
            <label htmlFor="rate">{t.f_rate}</label>
            <input className="input num" id="rate" inputMode="decimal" value={rateTxt}
                   onChange={(e) => { typed(e, setRateTxt); setRateTouched(true); }} />
            <span className="hint">{suggested ? (!rateTouched || rate === suggested ? (rateSugg?.src === 'last' ? t.f_rate_last : t.f_rate_auto) : '') : t.f_rate_missing}</span>
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
                   onChange={(e) => typed(e, setToAmountTxt)} />
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
                {d.ref ?? '—'} · {d.op_date.split('-').reverse().join('/')} · {money(Number(d.amount), d.currency, t.lang_code as Lang)} · {d.description}</a></li>
            ))}
          </ul>
        </div>
      )}
      {error && <div className="note err" role="alert">{error}</div>}

      <div className="factions">
        {(!initial || initial.status === 'draft') && !due && (
          <button type="button" className="btn" disabled={busy} onClick={() => save('draft')}>{t.f_save_draft}</button>
        )}
        <button type="submit" className="btn primary" disabled={busy}><Ico name="check" />{busy ? t.f_saving : due ? t.f_save_due : t.f_record}</button>
        <span className="hint" style={{ flex: '1 1 260px' }}>{due ? t.f_due_hint : t.f_record_hint}</span>
      </div>
    </form>
  );
}
