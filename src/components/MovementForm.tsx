'use client';
import { todayYmd, orgYear } from '@/lib/today';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Dict, Lang } from '@/lib/i18n';
import { money } from '@/lib/format';
import type { RefData } from '@/lib/movement-ref';
import { CAT_KEYWORDS } from '@/lib/cat-keywords';
import { extraDecimals, formatTyping, parseAmount, settleAmount } from '@/lib/amount';
import { useCaret } from '@/lib/use-caret';
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
type Doc = { key: string; label: string; state: 'uploading' | 'ok' | 'dup' | 'err' | 'local'; id?: string; preview?: string; dupOf?: string };
type AiKey = 'amount' | 'opDate' | 'docDate' | 'description' | 'category' | 'cp' | 'method';
type AiMark = { status: string; confidence: number; source: string | null; confirmed: boolean };
type AiField = { value: string | number | null; source: string | null; confidence: number; status: string; note?: string | null };
type AiResult = { fields: Record<string, AiField>; checks: { code: string; ok: boolean; message: string }[] };
const METHOD_HINT: Record<string, RegExp> = {
  cash: /contant|esp[eè]ce|cash/i, card: /carta|carte|card|bancomat/i, transfer: /bonifico|virement|transfer/i,
  mobile_money: /mobile|mvola|orange|airtel/i, cheque: /assegno|ch[eè]que/i,
};
type Dup = { id: string; ref: string | null; op_date: string; amount: string; currency: string; description: string };

const today = () => todayYmd();

// Precompilazione di un movimento nuovo (es. da una riga dell'estratto conto senza corrispondenza)
export type Prefill = { kind?: Kind; op_date?: string; amount?: number; account_id?: string; description?: string; own?: boolean; project_id?: string;
  // copia corretta di un movimento stornato: stessi dati e stessi allegati dell'originale
  category_id?: string; grant_id?: string; counterparty_id?: string; payment_method_id?: string; notes?: string; docs?: { id: string; label: string }[] };
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
  const setCaret = useCaret();
  const fmt = (n: number | string) => formatTyping(String(n).replace('.', ',')).text;
  const typed = (e: React.ChangeEvent<HTMLInputElement>, set: (v: string) => void) => {
    const el = e.target; const r = formatTyping(el.value, el.selectionStart ?? el.value.length);
    setCaret(el, r.caret); set(r.text); setDecCut(extraDecimals(el.value) ? el.id : '');
  };
  // campo in cui è stata appena scartata una terza cifra decimale: lo si dice sotto il campo
  const [decCut, setDecCut] = useState('');
  const [amountTxt, setAmountTxt] = useState(initial ? fmt(Number(initial.amount))
    : P?.amount ? fmt(P.amount) : '');
  // movimento nuovo senza dati precompilati: conto, progetto e modalità partono da quelli dell'ultimo movimento dello stesso
  // tipo inserito da questa persona (P2-21). Il conto di un anticipo non si propone: lì la scelta passa da «Come è stata pagata».
  const isOp = R.role === 'operator';
  // l'operatore lavora in Madagascar: vede solo i conti del Madagascar, se ce ne sono (revisione operatore, 16/11)
  const opMG = isOp && R.accounts.some((a) => a.location === 'MG' && a.kind !== 'advance');
  const lastMine = !initial && !P ? R.lastMine.expense : null;
  const lmAccount = lastMine?.account_id && R.accounts.some((a) => a.id === lastMine.account_id && a.kind !== 'advance') ? lastMine.account_id : '';
  // il progetto (centro di costo) non si propone mai dall'ultimo movimento: va scelto ogni volta, perché una spesa imputata
  // al progetto sbagliato passa inosservata (21/11, segnalazione del committente). Resta proposto solo quando viene da un dato
  // collegato: l'anticipo scelto (che ha il suo progetto) o un movimento aperto apposta con quel progetto.
  const lmProject = '';
  const lmMethod = lastMine?.payment_method_id && R.methods.some((x) => x.id === lastMine.payment_method_id) ? lastMine.payment_method_id : '';
  const opDefault = opMG && !lmAccount ? (R.accounts.find((a) => a.location === 'MG' && a.kind === 'cash' && a.currency === 'MGA') ?? R.accounts.find((a) => a.location === 'MG' && a.kind !== 'advance'))?.id ?? '' : '';
  // O1 (giro 12): chi ha in mano i contanti di un solo anticipo aperto parte da «Anticipo», con quel conto (altrimenti la spesa
  // fatta con quei contanti ridurrebbe una seconda volta la cassa)
  const advStart = !initial && !P?.account_id && !P?.own
    ? (() => { const open = R.accounts.filter((a) => a.kind === 'advance' && Number(a.balance ?? 0) > 0 && ((R.myAdvances ?? []).includes(a.id) || (a.holder ?? '').toLowerCase() === R.userName.toLowerCase())); return open.length === 1 ? open[0]!.id : ''; })()
    : '';
  const [accountId, setAccountId] = useState(initial?.account_id ?? P?.account_id ?? (advStart || lmAccount || opDefault));
  // chi ha speso materialmente (non chi registra) e spesa pagata di tasca propria, da rimborsare
  const [paidBy, setPaidBy] = useState(initial ? (initial.paid_by ?? '') : R.userName);
  // come è stata pagata una spesa: dall'ente (conto), di tasca propria (da rimborsare) o con l'anticipo di una persona
  // anticipi: prima quelli di chi compila (dalla richiesta o dal nome); l'operatore vede solo i suoi, se ne ha (revisione operatore, 16/11)
  const isMineAdv = (a: { id: string; holder: string | null }) => (R.myAdvances ?? []).includes(a.id) || (a.holder ?? '').toLowerCase() === R.userName.toLowerCase();
  const advAll = R.accounts.filter((a) => a.kind === 'advance');
  const advMine = advAll.filter(isMineAdv);
  // l'operatore vede solo i propri anticipi (mai quelli degli altri)
  // operatore: i propri anticipi e quelli di persone senza account (es. personale locale per cui registra le spese),
  // mai l'anticipo di un altro utente dell'app
  const otherUser = (a: { holder: string | null }) => (R.userNames ?? []).includes((a.holder ?? '').trim().toLowerCase());
  const advances = R.role === 'operator' ? [...advMine, ...advAll.filter((a) => !isMineAdv(a) && !otherUser(a) && Boolean(a.holder))] : [...advMine, ...advAll.filter((a) => !isMineAdv(a))];
  // dal portafoglio anticipi (conto anticipi già scelto) o da Rimborsi («di tasca propria») il modulo parte già impostato
  const [payMode, setPayMode] = useState<'org' | 'own' | 'adv'>(initial?.reimb_status === 'due' || (!initial && P?.own) ? 'own'
    : advStart || R.accounts.find((a) => a.id === (initial?.account_id ?? P?.account_id))?.kind === 'advance' ? 'adv' : 'org');
  // O4: progetto venuto dall'anticipo; se si cambia modo di pagamento torna da scegliere
  const prjFromAdv = useRef('');
  const ownPocket = payMode === 'own';
  const choosePay = (m: 'org' | 'own' | 'adv') => {
    setPayMode(m);
    if (m !== 'adv' && prjFromAdv.current) { const from = prjFromAdv.current; setProjectId((cur) => (cur === from ? '' : cur)); prjFromAdv.current = ''; }   // O4: valore letto prima di azzerarlo
    const isAdv = R.accounts.find((a) => a.id === accountId)?.kind === 'advance';
    if ((m === 'adv') !== isAdv) {
      // passando ad «Anticipo» si propone l'anticipo di chi compila, non quello di un altro
      const mine = m === 'adv' ? advMine : [];
      setAccountId(mine.length === 1 ? mine[0]!.id : '');
    }
  };
  const [otherKinds, setOtherKinds] = useState(false);
  const [tried, setTried] = useState<'draft' | 'recorded'>('recorded');
  // di tasca propria: la valuta proposta è quella del conto usato di solito (sul campo l'ariary), non sempre l'euro
  const [dueCurrency, setDueCurrency] = useState<'EUR' | 'MGA'>(initial ? (initial.currency === 'MGA' ? 'MGA' : 'EUR')
    : R.accounts.find((a) => a.id === lmAccount)?.currency === 'MGA' || (isOp && R.accounts.some((a) => a.location === 'MG')) ? 'MGA' : 'EUR');
  const [toAccountId, setToAccountId] = useState(initial?.to_account_id ?? '');
  const [toAmountTxt, setToAmountTxt] = useState(initial?.to_amount ? fmt(Number(initial.to_amount)) : '');
  const [rateTxt, setRateTxt] = useState(initial?.fx_rate ? fmt(Number(initial.fx_rate)) : '');
  const [rateTouched, setRateTouched] = useState(Boolean(initial?.fx_rate));
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? P?.category_id ?? '');
  const [projectId, setProjectId] = useState(initial?.project_id ?? P?.project_id ?? lmProject);
  const [grantId, setGrantId] = useState(initial?.grant_id ?? P?.grant_id ?? (() => { const pid = initial?.project_id ?? P?.project_id ?? ''; const own = pid ? R.grants.filter((g) => g.project_id === pid) : []; return !initial && own.length === 1 ? own[0]!.id : ''; })());
  const [cpId, setCpId] = useState(initial?.counterparty_id ?? P?.counterparty_id ?? '');
  const [cpNew, setCpNew] = useState('');
  const [methodId, setMethodId] = useState(initial?.payment_method_id ?? P?.payment_method_id ?? lmMethod);
  const [description, setDescription] = useState(initial?.description ?? P?.description ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? P?.notes ?? '');
  const [noDoc, setNoDoc] = useState(Boolean(initial?.no_doc_reason));
  const [noDocReason, setNoDocReason] = useState(initial?.no_doc_reason ?? '');
  const [docs, setDocs] = useState<Doc[]>((initial?.docs ?? P?.docs ?? []).map((d) => ({ key: d.id, label: d.label, state: 'ok', id: d.id })));
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
  // ricerca nel selettore delle voci: su 70 codici scorrere l'elenco è lento (revisione finale del 15/11)
  const [catQ, setCatQ] = useState('');
  const lang = t.lang_code === 'fr' ? 'fr' : 'it';
  const nq = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // ordine dei risultati: codice, nome, parole chiave, e solo per ultimo il nome del gruppo («riso» non deve dare prima «Risorse umane»)
  const catRank = (c: { code: string; name: string; group: string }, q: string) => { const w = (x: string) => new RegExp(`(^|[^a-z0-9])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(nq(x));
    return c.code.startsWith(q) ? 0 : w(c.name) ? 1 : w(CAT_KEYWORDS[c.code] ?? '') ? 2 : nq(c.name).includes(q) || nq(CAT_KEYWORDS[c.code] ?? '').includes(q) ? 3 : 4; };
  // risultati: codice, nome e parole comuni; il nome del gruppo solo se non c'è altro («riso» non deve dare i codici di «Risorse umane»)
  const hitsFor = (q0: string) => { const q = nq(q0.trim()); if (!q) return [];
    const r = cats.map((c) => [c, catRank(c, q)] as const).filter(([, k]) => k < 4).sort((a, b) => a[1] - b[1]).map(([c]) => c);
    return r.length ? r : cats.filter((c) => nq(c.group).includes(q)); };
  const catHits = hitsFor(catQ);
  // codici suggeriti dalle parole della descrizione (solo proposti come pulsanti: la scelta resta a chi registra)
  // O3 (giro 12): parole vuote ignorate, solo corrispondenze di parola intera (nome o parole chiave), vince il codice che
  // raccoglie più parole; al massimo due proposte, solo quelle col punteggio più alto
  const descSug = (() => { if (categoryId || catQ.trim()) return [];
    const STOP = new Set(['per', 'con', 'del', 'della', 'dello', 'dei', 'delle', 'degli', 'alla', 'alle', 'allo', 'agli', 'dal', 'dalla', 'nel', 'nella', 'sul', 'sulla', 'una', 'uno', 'gli', 'che', 'non', 'tra', 'fra', 'pour', 'avec', 'des', 'les', 'une', 'aux', 'dans', 'sur', 'par', 'pas', 'qui', 'que', 'est', 'son', 'ses', 'mon', 'mes', 'ton', 'notre', 'nos', 'vos', 'leur', 'leurs']);
    const score = new Map<string, number>();
    for (const w of new Set(nq(description).split(/[^\p{L}\p{N}]+/u).filter((x) => x.length >= 3 && !STOP.has(x))))
      for (const c of cats) if (catRank(c, w) <= 2) score.set(c.id, (score.get(c.id) ?? 0) + 1);
    const top = Math.max(0, ...score.values());
    return top ? cats.filter((c) => score.get(c.id) === top).slice(0, 2) : []; })();
  const recentCats = R.recentCats[dir === 'in' ? 'income' : 'expense'].map((id) => cats.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
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
    if (busy) return;   // durante il salvataggio non si cerca: troverebbe il movimento appena salvato (revisione 20/11)
    const h = setTimeout(async () => {
      const { data } = await supabase.rpc('find_duplicates', {
        p: { amount, currency, op_date: opDate, account_id: accountId, counterparty_id: cpId || null, exclude_id: initial?.id ?? null },
      });
      setDups((data ?? []) as Dup[]);
    }, 500);
    return () => clearTimeout(h);
  }, [amount, currency, opDate, accountId, cpId, initial?.id, supabase, due, busy]);

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
      // file già in archivio: si dice a quale movimento è allegato, perché di solito è la stessa spesa inserita due volte (P2-16)
      if (data.outcome === 'duplicate_file') {
        const { data: lk } = await supabase.from('movement_documents').select('movement:movements(id, ref, op_date, reimb_status)').eq('document_id', data.id).limit(3);
        const refs = ((lk ?? []) as unknown as { movement: { id: string; ref: string | null; op_date: string; reimb_status: string | null } | null }[])
          .map((l) => l.movement).filter((m): m is NonNullable<typeof m> => Boolean(m) && m!.id !== initial?.id)
          .map((m) => `${m.ref ?? (m.reimb_status === 'due' ? (t.lang_code === 'fr' ? 'dépense à rembourser' : 'spesa da rimborsare') : t.st_draft.toLowerCase())} ${t.f_doc_dup_of} ${m.op_date.slice(8, 10)}/${m.op_date.slice(5, 7)}`);
        if (refs.length) setDocs((d) => d.map((x) => (x.key === key ? { ...x, dupOf: refs.join(', ') } : x)));
      }
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
    amount: !amount, account: !accountId && !due, opDate: !!opDate && (Date.parse(opDate) - Date.now() > (R.role === 'operator' ? 0.5 : 61) * 864e5 || (R.role === 'operator' && Number(opDate.slice(0, 4)) < orgYear())), toAccount: kind === 'transfer' && !toAccountId,
    paidBy: kind === 'expense' && !paidBy.trim(),
    // operatore: la data del documento non può essere nel futuro (revisione 20/11: l'avviso restava fuori schermo e si registrava lo stesso)
    docDate: R.role === 'operator' && !!docDate && Date.parse(docDate) - Date.now() > 0.5 * 864e5,
    toAmount: kind === 'transfer' && !parseAmount(toAmountTxt),
    category: kind !== 'transfer' && !categoryId, project: kind === 'expense' && !projectId,
    rate: currency === 'MGA' && !rate, noDocReason: kind !== 'transfer' && noDoc && noDocReason.trim().length < 5,
    // descrizione obbligatoria per registrare (un movimento «Uscita» senza testo non si riconosce più); giustificativo se la regola è attiva:
    // tutti i campi mancanti si vedono insieme, non a tappe (revisione del 15/11)
    desc: kind !== 'transfer' && description.trim().length < 3,
    doc: kind !== 'transfer' && R.requireDoc && !noDoc && docs.length === 0,
  };

  // riepilogo accanto ai pulsanti: quali campi mancano per registrare
  // dopo un «Salva bozza» non riuscito si segnalano solo i campi che servono alla bozza (importo, conto, data)
  const DRAFT_KEYS = ['opDate', 'docDate', 'amount', 'account', 'toAccount'];
  const shown = (tried === 'draft' ? Object.fromEntries(Object.entries(missing).map(([k, v]) => [k, DRAFT_KEYS.includes(k) && v])) : missing) as typeof missing;
  const missingNames = ([['opDate', t.f_op_date], ['docDate', `${t.f_doc_date} ${t.lang_code === 'fr' ? '(dans le futur)' : '(nel futuro)'}`], ['amount', t.f_amount], ['account', t.f_account], ['toAccount', t.f_to_account], ['paidBy', t.f_paid_by], ['toAmount', t.f_to_amount],
    ['category', t.f_category], ['project', t.project], ['rate', t.f_rate], ['desc', t.f_description], ['doc', t.f_doc], ['noDocReason', t.lang_code === 'fr' ? 'pourquoi le justificatif manque' : 'perché manca il giustificativo']] as const)   // Q2: dice cosa manca davvero
    .filter(([k]) => shown[k]).map(([, l]) => l.toLowerCase()).filter((l, i, a) => a.indexOf(l) === i);

  function errorText(msg: string) {
    const code = msg.split(':')[0].trim();
    if (msg.includes('movements_expense_project')) return t.err_expense_project;
    const k = `err_${code}` as keyof Dict;
    if (k in t) return t[k];
    // mai il codice tecnico («invalid: …») davanti al messaggio (revisione operatore, 16/11)
    const rest = msg.includes(':') ? msg.slice(msg.indexOf(':') + 1).trim() : msg;
    return code === 'invalid' ? `${t.lang_code === 'fr' ? 'Donnée à corriger' : 'Dato da correggere'}${t.lang_code === 'fr' ? '\u00a0' : ''}: ${rest}` : `${t.err_generic}: ${rest}`;
  }

  async function save(status: 'draft' | 'recorded') {
    setError(null);
    setTried(status);
    const needed = status === 'recorded'
      ? Object.values(missing).some(Boolean)
      : missing.amount || missing.account || (kind === 'transfer' && missing.toAccount);
    // per la bozza bastano importo e conto: gli altri campi non si colorano di rosso (revisione operatore, 16/11)
    setTouched(status === 'recorded' || Boolean(needed));
    // il fuoco va al primo campo da completare (prima restava sul pulsante e l'errore poteva essere fuori schermo)
    if (needed) setTimeout(() => { const el = document.querySelector<HTMLElement>('.mform [aria-invalid="true"], .mform #giust .ferr'); if (el?.matches('.ferr')) el.scrollIntoView({ block: 'center' }); else el?.focus(); }, 60);
    // spesa di tasca propria: resta "da rimborsare" (bozza senza conto) finché un responsabile non la rimborsa
    if (due) status = 'draft';
    if (needed) {
      // su telefono gli errori restano fuori schermo: porto in vista il primo campo da correggere e gli do il fuoco
      requestAnimationFrame(() => {
        const first = document.querySelector('.mform .ferr');
        const field = first?.closest('.field, .panel-b') as HTMLElement | null;
        field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        (field?.querySelector('input:not([type=hidden]):not(.vh-file), select, textarea') as HTMLElement | null)?.focus({ preventScroll: true });
      });
      return;
    }
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
      savedOk.current = true; try { localStorage.removeItem(`yc-draft-${R.userId}`); } catch { /* memoria non disponibile */ }
      onQueued();
    };
    if (!initial && (!navigator.onLine || docs.some((d) => d.state === 'local'))) {
      try { await queue(); } catch (e) { setError(errorText(String((e as Error)?.message ?? e))); setBusy(false); }
      return;
    }
    // rete lenta (16/11): se il server non risponde entro 6 secondi, il movimento nuovo va nella coda e chi registra
    // può andare avanti. Nessun doppione: la coda usa lo stesso client_uuid, e un secondo invio risponde «duplicate».
    // Non vale con una controparte nuova (verrebbe creata due volte) né per le modifiche.
    let slowQueued = false;
    const slowT = !initial && cpId !== '__new' ? setTimeout(() => { slowQueued = true; void queue().catch(() => { slowQueued = false; }); }, 6000) : undefined;
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
      clearTimeout(slowT);
      if (slowQueued) return;                      // già in coda e pagina già cambiata: la coda vedrà «duplicate»
      if (error) throw error;
      if (data.outcome === 'conflict') { setError(t.f_conflict); setBusy(false); return; }
      if (!initial) { savedOk.current = true; try { localStorage.removeItem(`yc-draft-${R.userId}`); } catch { /* memoria non disponibile */ } }
      // spesa registrata senza giustificativo, con la scelta «prepara l'autocertificazione»: la scheda si apre sul modulo
      const goAut = (status === 'recorded' || due) && kind === 'expense' && noDoc && wantAut && docs.length === 0;   // Q3: anche «Salva da rimborsare»
      router.push(`/movimenti/${data.id}?ok=${initial && !(initial.status === 'draft' && status === 'recorded') ? 'saved' : 'new'}${goAut ? '&aut=1' : ''}`);
      router.refresh();
    } catch (e) {
      clearTimeout(slowT);
      if (slowQueued) return;
      // la rete è caduta durante l'invio: il movimento nuovo va nella coda invece di andare perso
      if (!initial && isNetworkError(e)) { try { await queue(); return; } catch { /* sotto: errore mostrato */ } }
      setError(errorText((e as { message?: string }).message ?? String(e)));
      setBusy(false);
    }
  }

  // accessibilità (16/11): i campi obbligatori sono dichiarati tali, e il messaggio «Campo obbligatorio» è collegato al suo campo
  useEffect(() => {
    const need: Record<string, boolean> = { amount: true, account: !due, category: kind !== 'transfer', project: kind === 'expense', desc: kind !== 'transfer', paidby: kind === 'expense' };
    Object.entries(need).forEach(([id, on]) => { const el = document.getElementById(id); if (el) { if (on) el.setAttribute('aria-required', 'true'); else el.removeAttribute('aria-required'); } });
    document.querySelectorAll<HTMLElement>('.mform .field, .mform #giust').forEach((f, i) => {
      const e = f.querySelector<HTMLElement>('.ferr'); const cs = f.matches('#giust') ? f.querySelectorAll<HTMLElement>('button, input[type=checkbox]') : f.querySelectorAll<HTMLElement>('input, select, textarea');
      if (e && !e.id) e.id = `ferr-${i}`;
      cs.forEach((c) => { if (e) c.setAttribute('aria-describedby', e.id); else if (c.getAttribute('aria-describedby')?.startsWith('ferr-')) c.removeAttribute('aria-describedby'); });
    });
  });
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
  const methodField = (
        <div className={aiCls('method')}>
          <label htmlFor="method">{t.f_method}</label>
          <select className="input" id="method" value={methodId} onChange={(e) => { setMethodId(e.target.value); confirm('method'); }}>
            <option value="">{t.f_choose}</option>
            {R.methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {aiTag('method')}
        </div>
  );
  const advMode = kind === 'expense' && payMode === 'adv';
  // spesa con un anticipo: «Pagato da» è sempre il titolare dell'anticipo, comunque il conto sia stato scelto
  // (a mano, proposto, o da «+ Ricevuta») — revisione 19/11, MOV con l'anticipo di un'altra persona
  const advHolder = advMode ? R.accounts.find((a) => a.id === accountId)?.holder ?? null : null;
  useEffect(() => { if (advHolder) setPaidBy(advHolder); }, [advHolder]);
  // spesa con un anticipo legato a un progetto: il progetto viene dall'anticipo (dato collegato, non un'ipotesi), se non è già scelto
  const advPrj = advMode ? R.advProject?.[accountId] : undefined;
  useEffect(() => { if (advPrj && R.projects.some((x) => x.id === advPrj)) setProjectId((cur) => { if (cur) return cur; prjFromAdv.current = advPrj; return advPrj; }); }, [advPrj, R.projects]);
  // gli anticipi non si scelgono come conto di una spesa dell'ente o di un'entrata (solo con «Con l'anticipo» o nei giroconti)
  // operatore: solo i conti del Madagascar, anche in modifica (resta visibile il conto già scelto, se fosse italiano)
  const accVisible = (a: { id: string; location: string | null }) => !opMG || a.location === 'MG' || a.id === accountId || a.id === toAccountId;
  const accOptions = (exclude?: string, noAdvance = false) => (['IT', 'MG'] as ('IT' | 'MG')[]).filter((loc) => R.accounts.some((a) => a.location === loc && accVisible(a))).map((loc) => (
    <optgroup key={loc} label={loc === 'IT' ? t.italy : t.madagascar}>
      {R.accounts.filter((a) => a.location === loc && accVisible(a) && a.id !== exclude && !(noAdvance && a.kind === 'advance')).map((a) => (
        <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>
      ))}
    </optgroup>
  ));
  const recordedLocked = initial && initial.status !== 'draft';
  // ── inserimento lasciato a metà (P2-14): i campi restano sul dispositivo e vengono riproposti alla riapertura ──
  // vale solo per un movimento nuovo aperto senza dati precompilati; gli allegati non si conservano e vanno ricaricati
  const draftKey = `yc-draft-${R.userId}`;
  const draftOn = !initial && !P;
  type LocalDraft = { at: number; kind: Kind; opDate: string; amountTxt: string; accountId: string; categoryId: string; projectId: string; grantId: string; cpId: string; methodId: string; description: string; notes: string };
  const [pending, setPending] = useState<LocalDraft | null>(null);
  const [wantAut, setWantAut] = useState(true);
  const savedOk = useRef(false);   // dopo il salvataggio la bozza locale non va riscritta
  useEffect(() => {
    if (!draftOn) return;
    try {
      const raw = localStorage.getItem(draftKey);
      const d = raw ? JSON.parse(raw) as LocalDraft : null;
      if (d && Date.now() - d.at < 7 * 86400000 && (d.amountTxt || d.description)) setPending(d); else if (raw) localStorage.removeItem(draftKey);
    } catch { /* memoria del dispositivo non disponibile: si lavora senza */ }
  }, [draftOn, draftKey]);
  useEffect(() => {
    if (!draftOn || pending) return;
    if (!amountTxt && !description.trim()) return;
    const h = setTimeout(() => {
      if (savedOk.current) return;
      try {
        localStorage.setItem(draftKey, JSON.stringify({ at: Date.now(), kind, opDate, amountTxt, accountId, categoryId, projectId, grantId: grantId ?? '', cpId: cpId === '__new' ? '' : cpId, methodId, description, notes } satisfies LocalDraft));
      } catch { /* idem */ }
    }, 600);
    return () => clearTimeout(h);
  }, [draftOn, pending, draftKey, kind, opDate, amountTxt, accountId, categoryId, projectId, grantId, cpId, methodId, description, notes]);
  // un messaggio di errore non resta in pagina dopo che si è corretto ciò che mancava
  useEffect(() => { setError(null); }, [noDoc, noDocReason, docs.length]);
  const dropDraft = () => { try { localStorage.removeItem(draftKey); } catch { /* idem */ } setPending(null); };
  const resumeDraft = () => {
    const d = pending; if (!d) return;
    setKind(d.kind); setOpDate(d.opDate); setAmountTxt(d.amountTxt); setAccountId(d.accountId); setCategoryId(d.categoryId);
    setProjectId(d.projectId); setGrantId(d.grantId); setCpId(d.cpId); setMethodId(d.methodId); setDescription(d.description); setNotes(d.notes);
    setPending(null);
  };

  return (
    <form className="stack mform" onSubmit={(e) => { e.preventDefault(); save('recorded'); }} noValidate>
      {pending && (
        <div className="note draft-note" role="status">
          <span><b>{t.f_draft_found}</b> {pending.description || pending.amountTxt}{pending.description && pending.amountTxt ? ` · ${pending.amountTxt}` : ''} · {new Date(pending.at).toLocaleString(t.lang_code === 'fr' ? 'fr-FR' : 'it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. {t.f_draft_files}</span>
          <span className="row-btns eq"><button type="button" className="btn primary" onClick={resumeDraft}>{t.f_draft_resume}</button><button type="button" className="btn" onClick={dropDraft}>{t.f_draft_drop}</button></span>
        </div>
      )}
      {scanQueue[0] && (
        <ScanEditor key={scanQueue[0].name + scanQueue.length} file={scanQueue[0]} t={t}
                    onDone={(r) => { setScanQueue((q) => q.slice(1)); upload(r); }}
                    onCancel={() => setScanQueue((q) => q.slice(1))} />
      )}
      <section className="panel doc-first" id="giust"><div className="panel-h"><h2>{t.f_doc}</h2>{touched && shown.doc && <span className="ferr">{t.f_required}</span>}{kind === 'transfer' && <span className="muted" style={{ fontSize: 13 }}>{t.f_doc_optional}</span>}</div><div className="panel-b stack" style={{ gap: 12 }}>
      <div className="pair2">
        <label className="btn primary big-touch"><Ico name="camera" size={20} />{t.f_doc_photo}
          <input type="file" accept="image/*" capture="environment" className="vh-file" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </label>
        <label className="btn big-touch"><Ico name="upload" />{t.f_doc_file}
          <input type="file" accept="image/*,application/pdf" multiple className="vh-file" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
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
              {/* avviso lungo (foto già allegata a un altro movimento): testo che va a capo, non un'etichetta tagliata (20/11) */}
              <span className={d.state === 'dup' && d.dupOf ? 'hint warn-txt doc-dup' : `chip ${d.state === 'ok' ? 'ok' : d.state === 'err' ? 'err' : 'warn'}`}>
                {d.state === 'uploading' ? t.f_doc_uploading : d.state === 'ok' ? t.f_doc_ok : d.state === 'dup' ? (d.dupOf ? t.f_doc_dup_mov.replace('{m}', d.dupOf) : t.f_doc_dup) : d.state === 'local' ? t.f_doc_local : t.f_doc_err}
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
          <input className="input" id="nodoc" aria-invalid={touched && shown.noDocReason ? true : undefined} value={noDocReason} onChange={(e) => setNoDocReason(e.target.value)} />
          {req(shown.noDocReason)}
          <div className="chips-row" role="group" aria-label={t.f_no_doc_reason}>
            {t.f_no_doc_presets.split('|').map((r) => <button type="button" key={r} className="chip-btn" aria-pressed={noDocReason === r} onClick={() => setNoDocReason(r)}>{r}</button>)}
          </div>
          {/* senza giustificativo la spesa si documenta con un'autocertificazione: si può prepararla subito dopo la registrazione */}
          {kind === 'expense' && !recordedLocked && (
            <label className="check aut-opt"><input type="checkbox" checked={wantAut} onChange={(e) => setWantAut(e.target.checked)} /> {t.f_aut_after}</label>)}
        </div>
      )}
      <div className={aiCls('docDate')}>
        <label htmlFor="docdate">{t.f_doc_date}</label>
        <input className="input" id="docdate" type="date" aria-invalid={touched && shown.docDate ? true : undefined} value={docDate} onChange={(e) => { setDocDate(e.target.value); confirm('docDate'); }} style={{ maxWidth: 220 }} />
        {docDate && docDate > todayYmd() && <span className="hint warn-txt" role="status">{t.lang_code === 'fr' ? 'La date du justificatif est dans le futur : vérifiez-la.' : 'La data del giustificativo è nel futuro: controllala.'}</span>}
        {aiTag('docDate')}
      </div>
      </div></section>

      {/* l'operatore registra quasi solo spese: entrate e giroconti restano a un tocco («Altro tipo»), revisione del 16/11 */}
      {isOp && !otherKinds && kind === 'expense' ? (
        <div className="kinds-op"><span className="chip ichip"><Ico name="expense" size={16} />{t.k_expense}</span>
          <button type="button" className="btn ghost small" onClick={() => setOtherKinds(true)}>{t.lang_code === 'fr' ? 'Autre type…' : 'Altro tipo…'}</button></div>
      ) : (
      <div className="seg kinds" role="group" aria-label={t.f_kind}>
        {(['expense', 'income', 'transfer'] as const).map((k) => (
          <button type="button" key={k} aria-pressed={kind === k} disabled={Boolean(recordedLocked)}
                  onClick={() => { setKind(k); setCategoryId(''); if (k === 'income' && R.accounts.find((a) => a.id === accountId)?.kind === 'advance') setAccountId(''); }}><Ico name={k} size={18} />{t[`k_${k}`]}</button>
        ))}
      </div>
      )}

      <section className="panel"><div className="panel-b fgrid">
        {/* la descrizione per prima (21/11, richiesta del committente): si scrive cosa si è comprato guardando lo scontrino,
            e le sue parole propongono il codice contabile più sotto */}
        <div className={`${aiCls('description')} span2`}>
          <label htmlFor="desc">{t.f_description}</label>
          <input className="input" id="desc" aria-invalid={touched && shown.desc ? true : undefined} maxLength={500} placeholder={t.f_description_ph} value={description}
                 onChange={(e) => { setDescription(e.target.value); confirm('description'); }} />
          {req(shown.desc)}
          {descSug.length > 0 && (
            <div className="chips-row cat-quick cat-sug" role="group" aria-label={lang === 'fr' ? 'Code suggéré par la description' : 'Codice suggerito dalla descrizione'}>
              <span className="hint">{lang === 'fr' ? 'Code suggéré :' : 'Codice suggerito:'}</span>
              {descSug.map((c) => <button key={`s-${c.id}`} type="button" className="chip-btn" onClick={() => { setCategoryId(c.id); confirm('category'); }}><b>{c.code}</b> {c.name.split(' (')[0]}</button>)}
            </div>)}
          {aiTag('description')}
        </div>
        <div className={aiCls('amount')}>
          <label htmlFor="amount">{t.f_amount}{account || due ? ` (${currency})` : ''}</label>
          <input className="input big num" id="amount" aria-invalid={touched && shown.amount ? true : undefined} inputMode="decimal" autoComplete="off" value={amountTxt}
                 onChange={(e) => { typed(e, setAmountTxt); confirm('amount'); }} onBlur={() => setAmountTxt((v) => settleAmount(v))} placeholder="0,00" />
          {aiTag('amount')}
          {aiCurrency && account && aiCurrency !== currency && <span className="ferr">{t.ai_currency_diff} {aiCurrency}</span>}
          {req(shown.amount)}
          {(payMode === 'own' || isOp) && currency === 'EUR' && amount != null && amount >= 1000 && <span className="hint warn-txt" role="status">{t.lang_code === 'fr' ? `Ce sont vraiment ${money(amount, 'EUR', 'fr')} ? Si vous avez payé en ariary, choisissez MGA.` : `Sono davvero ${money(amount, 'EUR', 'it')}? Se hai pagato in ariary, scegli MGA.`}</span>}
          {decCut === 'amount' && <span className="hint warn-txt" role="status">{t.lang_code === 'fr' ? 'Deux décimales au maximum : le chiffre en plus n’a pas été écrit.' : 'Al massimo due decimali: la cifra in più non è stata scritta.'}</span>}
          {amount ? <span className="hint amt-echo">{t.f_amount_read}{t.lang_code === 'fr' ? '\u00a0' : ''}: <b>{money(amount, currency || 'EUR', t.lang_code as Lang)}</b>
            {currency === 'MGA' && rate ? <> · {t.f_eur_equiv}{t.lang_code === 'fr' ? '\u00a0' : ''}: {money(amount / rate, 'EUR', t.lang_code as Lang)}</> : null}
            {currency === 'MGA' && amount % 1 ? <> · {t.f_mga_round}</> : null}</span> : null}
          {/* cassa in contanti sotto zero: avviso, non blocco (di solito è la spesa sul conto sbagliato o un prelievo non registrato) */}
          {!initial && !isOp && payMode === 'org' && kind === 'expense' && account?.kind === 'cash' && account.balance != null && amount != null && amount > 0 && amount > account.balance + 0.005
            ? <span className="hint warn-txt" role="status">{t.f_cash_neg.replace('{c}', account.name).replace('{s}', money(account.balance, account.currency, t.lang_code as Lang))}</span> : null}
        </div>
        <div className={aiCls('opDate')}>
          <label htmlFor="opdate">{t.f_op_date}</label>
          <input className="input" id="opdate" type="date" value={opDate} onChange={(e) => { setOpDate(e.target.value); confirm('opDate'); }} />
          {(() => { const today = todayYmd(); if (!opDate) return null;
            const diff = Math.round((Date.parse(opDate) - Date.parse(today)) / 864e5);
            if (R.role === 'operator' && diff > 0) return <span className="ferr" role="alert">{t.lang_code === 'fr' ? 'Cette date est dans le futur : corrigez-la.' : 'Questa data è nel futuro: correggila.'}</span>;
            if (R.role === 'operator' && Number(opDate.slice(0, 4)) < orgYear()) return <span className="ferr" role="alert">{t.lang_code === 'fr' ? `Les dépenses de ${opDate.slice(0, 4)} sont saisies par un responsable.` : `Le spese del ${opDate.slice(0, 4)} le registra un responsabile.`}</span>;
            return diff > 60 ? <span className="ferr" role="alert">{t.lang_code === 'fr' ? 'La date est trop loin dans le futur : corrigez-la.' : 'La data è troppo nel futuro: correggila.'}</span>
              : diff > 0 ? <span className="hint warn-txt" role="status">{t.lang_code === 'fr' ? 'La date est dans le futur : vérifiez-la.' : 'La data è nel futuro: controllala.'}</span>
              : diff < -30 ? <span className="hint warn-txt" role="status">{t.lang_code === 'fr' ? `C’est il y a plus de 30 jours (${-diff} j) : vérifiez la date.` : `È di più di 30 giorni fa (${-diff} gg): controlla la data.`}</span> : null; })()}
          {aiTag('opDate')}
        </div>
        {kind === 'expense' && (<>
          <div className="field">
            <label htmlFor="paidby">{t.f_paid_by}</label>
            <input className="input" id="paidby" list="payers" maxLength={120} value={paidBy} onChange={(e) => setPaidBy(e.target.value)} />
            <datalist id="payers">{R.payers.map((n) => <option key={n} value={n} />)}</datalist>
            <span className="hint">{t.f_paid_by_hint}</span>
            {req(shown.paidBy)}
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
            {payMode === 'adv' && kind === 'expense' && !advances.length ? <span className="hint warn-txt" role="status">{t.lang_code === 'fr' ? 'Vous n’avez pas d’avance ouverte. ' : 'Non hai anticipi aperti. '}<Link href="/anticipi">{t.lang_code === 'fr' ? 'Demander une avance' : 'Chiedi un anticipo'}</Link></span>
              : payMode === 'adv' && kind === 'expense' && <span className="hint">{t.f_adv_hint}</span>}
            {payMode === 'adv' && kind === 'expense' && account?.kind === 'advance' && account.balance != null && (
              <span className="hint adv-left" role="status"><b>{(R.myAdvances ?? []).includes(account.id) ? (t.lang_code === 'fr' ? 'Vous avez en main' : 'Hai in mano') : (t.lang_code === 'fr' ? `${account.holder ?? 'La personne'} a en main` : `${account.holder ?? 'La persona'} ha in mano`)}{t.lang_code === 'fr' ? '\u00a0' : ''}: {money(account.balance, account.currency, t.lang_code as Lang)}</b>
                {amount ? <> · {t.lang_code === 'fr' ? 'après cette dépense' : 'dopo questa spesa'}{t.lang_code === 'fr' ? '\u00a0' : ''}: {money(account.balance - amount, account.currency, t.lang_code as Lang)}</> : null}</span>)}
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
            <select className="input" id="account" aria-invalid={touched && shown.account ? true : undefined} value={accountId ?? ''} onChange={(e) => {
              setAccountId(e.target.value);
              const h = R.accounts.find((a) => a.id === e.target.value)?.holder;
              if (advMode && h) setPaidBy(h);
            }}>
              <option value="">{t.f_choose}</option>
              {advMode ? (() => { const mine = advances.filter((a) => isMineAdv(a)), others = advances.filter((a) => !isMineAdv(a)); const opt = (a: typeof advances[number]) => <option key={a.id} value={a.id}>{a.holder ?? a.name} · {a.currency}</option>;
                // i propri anticipi separati da quelli di altre persone (per cui si registra la spesa): mai confusi (21/11)
                return others.length ? <>{mine.length > 0 && <optgroup label={t.lang_code === 'fr' ? 'Vos avances' : 'I tuoi anticipi'}>{mine.map(opt)}</optgroup>}
                  <optgroup label={t.lang_code === 'fr' ? 'Avances d’autres personnes' : 'Anticipi di altre persone'}>{others.map(opt)}</optgroup></> : mine.map(opt); })() : accOptions(undefined, kind !== 'transfer')}
            </select>
            {lmAccount && accountId === lmAccount && !advMode && kind !== 'transfer' ? <span className="hint">{t.f_from_last}</span> : null}
            {req(shown.account)}
          </div>
        )}
        {currency === 'MGA' && (
          <div className="field">
            <label htmlFor="rate">{t.f_rate}</label>
            <input className="input num" id="rate" inputMode="decimal" value={rateTxt} readOnly={isOp && Boolean(suggested)}
                   onChange={(e) => { typed(e, setRateTxt); setRateTouched(true); }} onBlur={() => setRateTxt((v) => settleAmount(v))} />
            <span className="hint">{suggested ? (!rateTouched || rate === suggested ? (rateSugg?.src === 'last' ? t.f_rate_last : t.f_rate_auto) : '') : t.f_rate_missing}</span>
            {req(shown.rate)}
          </div>
        )}
        {kind === 'transfer' && (<>
          <div className="field">
            <label htmlFor="toaccount">{t.f_to_account}</label>
            <select className="input" id="toaccount" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              <option value="">{t.f_choose}</option>{accOptions(accountId)}
            </select>
            {req(shown.toAccount)}
          </div>
          <div className="field">
            <label htmlFor="toamount">{t.f_to_amount}{toAccount ? ` (${toAccount.currency})` : ''}</label>
            <input className="input num" id="toamount" inputMode="decimal" value={toAmountTxt}
                   disabled={Boolean(account && toAccount && account.currency === toAccount.currency)}
                   onChange={(e) => typed(e, setToAmountTxt)} onBlur={() => setToAmountTxt((v) => settleAmount(v))} />
            {req(shown.toAmount)}
          </div>
        </>)}
        {kind !== 'transfer' && (<>
          <div className={aiCls('category')}>
            <label htmlFor="category">{t.f_category}</label>
            {cats.length > 15 && (
              <input className="input cat-q" type="search" inputMode="search" value={catQ} onChange={(e) => { const q = e.target.value; setCatQ(q);
                // revisione 19/11: nessuna scelta automatica; un codice scelto prima che non è tra i risultati si toglie,
                // così non resta selezionato un codice che chi cerca non vede
                const hits = hitsFor(q); if (q.trim() && categoryId && !hits.some((c) => c.id === categoryId)) setCategoryId(''); }} aria-label={lang === 'fr' ? 'Chercher un code comptable par numéro ou par nom' : 'Cerca un codice contabile per numero o per nome'}
                placeholder={lang === 'fr' ? 'Chercher un code…' : 'Cerca un codice…'} />)}
            {catQ.trim() && (catHits.length
              ? <div className="chips-row cat-quick" role="group" aria-label={lang === 'fr' ? 'Codes trouvés' : 'Codici trovati'}>
                  {catHits.slice(0, 8).map((c) => <button key={`h-${c.id}`} type="button" className={`chip-btn${categoryId === c.id ? ' on' : ''}`} aria-pressed={categoryId === c.id} onClick={() => { setCategoryId(c.id); confirm('category'); }}>
                    <b>{c.code}</b> {c.name.split(' (')[0]}</button>)}
                  {catHits.length > 8 && <span className="hint">{lang === 'fr' ? `+ ${catHits.length - 8} dans la liste` : `+ altri ${catHits.length - 8} nell’elenco`}</span>}</div>
              : <p className="hint warn-txt cat-none" role="status">{lang === 'fr' ? `Aucun code pour « ${catQ.trim()} ». Essayez un mot plus général (« nourriture », « transport ») ou choisissez dans la liste ci-dessous, qui montre tous les codes.` : `Nessun codice per «${catQ.trim()}». Prova una parola più generale («cibo», «trasporto») o scegli dall’elenco qui sotto, che mostra tutti i codici.`}</p>)}
            {/* codici più usati: un tocco li sceglie (i propri recenti, altrimenti i sei più comuni sul campo) */}
            {dir === 'out' && !catQ.trim() && (() => { const quick = [...recentCats.filter((c) => !descSug.includes(c)), ...['202', '203', '204', '307', '401', '606'].map((k) => cats.find((c) => c.code === k)).filter((c): c is NonNullable<typeof c> => Boolean(c))].filter((c, i, all) => !descSug.includes(c) && all.findIndex((x) => x.id === c.id) === i).slice(0, 6);
              return quick.length > 1 ? <div className="chips-row cat-quick" role="group" aria-label={lang === 'fr' ? 'Codes fréquents' : 'Codici frequenti'}>
                {quick.map((c) => <button key={`f-${c.id}`} type="button" className={`chip-btn${categoryId === c.id ? ' on' : ''}`} aria-pressed={categoryId === c.id} onClick={() => { setCategoryId(c.id); confirm('category'); }}>
                  <b>{c.code}</b> {c.name.split(' (')[0]}</button>)}</div> : null; })()}
            <select className="input" id="category" aria-invalid={touched && shown.category ? true : undefined} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); confirm('category'); }}>
              <option value="">{catQ.trim() && catHits.length ? (lang === 'fr' ? (catHits.length === 1 ? '1 code trouvé : touchez-le ci-dessus' : `${catHits.length} codes trouvés : touchez-en un ci-dessus`) : (catHits.length === 1 ? '1 codice trovato: toccalo qui sopra' : `${catHits.length} codici trovati: toccane uno qui sopra`)) : t.f_choose}</option>
              {catQ.trim() && catHits.length ? [...catHits, ...cats.filter((c) => c.id === categoryId && !catHits.includes(c))].map((c) => <option key={`q-${c.id}`} value={c.id}>{c.code} · {c.name}</option>) : null}
              {!(catQ.trim() && catHits.length) && recentCats.length > 0 && (
                <optgroup label={t.f_recent}>
                  {recentCats.map((c) => <option key={`r-${c.id}`} value={c.id}>{c.code} · {c.name}</option>)}
                </optgroup>)}
              {!(catQ.trim() && catHits.length) && groups.map((g) => (
                <optgroup key={g} label={g}>
                  {cats.filter((c) => c.group === g).map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
                </optgroup>
              ))}
            </select>
            {aiTag('category')}
            {req(shown.category)}
          </div>
          <div className="field">
            <label htmlFor="project">{t.f_project}</label>
            <select className="input" id="project" aria-invalid={touched && shown.project ? true : undefined} value={projectId} onChange={(e) => {
              const pid = e.target.value; setProjectId(pid);
              // se il progetto ha un solo finanziamento, lo propongo già scelto (si può togliere): partire da «Nessuno» sottostima il rendiconto
              const own = R.grants.filter((g) => g.project_id === pid);
              setGrantId(own.length === 1 ? own[0]!.id : R.grants.some((g) => g.id === grantId && (!g.project_id || g.project_id === pid)) ? grantId : '');
            }}>
              <option value="">{kind === 'income' ? t.f_cp_none : t.f_choose}</option>
              {R.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {kind === 'expense' && <span className="hint">{t.f_project_hint}</span>}
            {req(shown.project)}
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
        {!isOp && methodField}
      </div></section>

      {isOp ? (
        // operatore: modalità di pagamento e note sono facoltative, chiuse sotto «Altri dettagli» (una schermata in meno)
        <details className="panel op-more" open={Boolean(methodId || notes)}>
          <summary className="panel-b">{t.lang_code === 'fr' ? 'Autres détails (mode de paiement, notes)' : 'Altri dettagli (modalità di pagamento, note)'}</summary>
          <div className="panel-b fgrid">{methodField}
            <div className="field span2"><label htmlFor="notes">{t.f_notes}</label>
              <textarea className="input" id="notes" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} /></div></div>
        </details>
      ) : (
      <section className="panel"><div className="panel-b field">
        <label htmlFor="notes">{t.f_notes}</label>
        <textarea className="input" id="notes" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div></section>)}

      {dups.length > 0 && !busy && (
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
      {error && <div className="note err" role="alert">{error}
        {/* l'errore sul giustificativo si risolve in cima al modulo: un pulsante porta lì (visto sul telefono vero il 15/11) */}
        {error === t.err_document_required && <button type="button" className="btn small" style={{ marginTop: 8 }} onClick={() => document.getElementById('giust')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t.f_go_doc}</button>}
      </div>}

      <div className="factions">
        {(!initial || initial.status === 'draft') && !due && (
          <button type="button" className="btn" disabled={busy} aria-busy={busy && tried === 'draft' ? true : undefined} onClick={() => save('draft')}>{busy && tried === 'draft' ? t.f_saving : t.f_save_draft}</button>
        )}
        <button type="submit" className="btn primary" disabled={busy}><Ico name="check" />{busy && tried !== 'draft' ? t.f_saving : due ? t.f_save_due : t.f_record}</button>
        <span className="hint" style={{ flex: '1 1 260px' }}>{due ? t.f_due_hint : t.f_record_hint} {t.lang_code === 'fr' ? '* obligatoire pour comptabiliser.' : '* obbligatorio per registrare.'}</span>
        {touched && missingNames.length > 0 && <span className="ferr mform-miss" role="alert">{tried === 'draft' ? (t.lang_code === 'fr' ? 'Pour enregistrer le brouillon il manque' : 'Per salvare la bozza mancano') : due ? (t.lang_code === 'fr' ? 'Pour enregistrer il manque' : 'Per salvare mancano') : t.f_missing_list}{t.lang_code === 'fr' ? '\u00a0' : ''}: {missingNames.join(', ')}</span>}
      </div>
    </form>
  );
}
