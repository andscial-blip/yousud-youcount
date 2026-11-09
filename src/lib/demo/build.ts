// Dati dimostrativi per provare YouCount (grafici, filtri, preventivo, scostamenti, cambi).
// Base: il foglio Excel «01. Contabilità 2026» (righe di preventivo e tassi di cambio reali, in excel-2026.json).
// Tutto il resto è INVENTATO e marcato: movimenti DEMO-AAAA-NNN con nota «DEMO», controparti «(demo)», preventivo «DEMO».
// Deterministico: stessi dati a ogni caricamento (generatore pseudo-casuale con seme fisso).
import xl from './excel-2026.json';

type Item = { prj: string; dir: 'in' | 'out'; desc: string; code: string | null; unit: string | null; qty: number | null; mga: number | null; eur: number | null; tot: number; note: string | null };
const X = xl as unknown as { budget: Item[]; fx: { date: string; rate: number }[]; rate_budget: number; budget_date: string; source: string };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r2 = (v: number) => Math.round(v * 100) / 100;
const pad = (n: number) => String(n).padStart(2, '0');

const STRUCT = 'Spese generali';
const prjName = (p: string) => (p === 'General' ? STRUCT : p.trim());

// costo indicativo per unità (EUR) delle righe di progetto senza importo nel foglio: solo per la DEMO
const UNIT_COST: Record<string, [number, number]> = {
  '101': [60, 120], '103': [80, 300], '105': [8, 15], '202': [5, 25], '206': [15, 60], '401': [5, 40], '501': [150, 600], '503': [60, 250],
  '303': [8, 30], '107': [50, 200], '305': [100, 500], '301': [30, 120], '601': [80, 200], '505': [400, 2500], '607': [40, 200], '602': [15, 40],
  '603': [5, 20], '604': [10, 30], '606': [10, 30], '608': [50, 200], '308': [10, 60], '802': [20, 120], '803': [50, 300], '999': [20, 150],
};

export function buildDemo(year: number, mgaRate = 5000) {
  const R = rng(20260519);
  const pick = <T,>(a: T[]) => a[Math.floor(R() * a.length)]!;
  const between = (a: number, b: number) => a + R() * (b - a);

  const projects = [...new Set(X.budget.map((b) => prjName(b.prj)))].map((name) => ({ name, kind: name === STRUCT ? 'structure' : 'project' }));
  projects.push({ name: 'École Anjazafohy', kind: 'project' }, { name: 'Sapone Solidale', kind: 'project' }, { name: 'Agricoltura', kind: 'project' });

  const counterparties = [
    ['Quincaillerie Analakely (demo)', 'supplier'], ['Librairie Mixte Antananarivo (demo)', 'supplier'], ['Jirama – energia e acqua (demo)', 'supplier'],
    ['Taxi-brousse Cotisse (demo)', 'supplier'], ['Telma Madagascar (demo)', 'supplier'], ['Shoprite Ankorondrano (demo)', 'supplier'],
    ['Air Madagascar (demo)', 'supplier'], ['Studio Rossi commercialisti (demo)', 'supplier'], ['Menuiserie Andry (demo)', 'supplier'],
    ['Fondazione Aurora (demo)', 'donor'], ['Donatori privati (demo)', 'donor'], ['Parrocchia San Marco (demo)', 'donor'],
    ['Comune di Monza (demo)', 'donor'], ['Associazione Amici del Madagascar (demo)', 'donor'],
  ].map(([name, kind]) => ({ name, kind }));

  // tassi: quelli del foglio Excel sono reali (fonte indicata); i mesi successivi sono DEMO
  const fx: { year: number; month: number; rate: number; source: string; demo: boolean }[] =
    X.fx.map((f) => ({ year: +f.date.slice(0, 4), month: +f.date.slice(5, 7), rate: f.rate, source: `${X.source} · 04. Exchange Rate (${f.date})`, demo: false }));
  { let rate = X.fx[X.fx.length - 1]!.rate;
    for (let y = 2025, m = 6; y < year || (y === year && m <= 12); m === 12 ? (y++, m = 1) : m++) {
      rate = r2(rate * (1 + between(-0.012, 0.016)));
      fx.push({ year: y, month: m, rate, source: 'DEMO · tasso inventato per le prove', demo: true });
    } }
  const rateOf = (d: string) => fx.find((f) => f.year === +d.slice(0, 4) && f.month === +d.slice(5, 7))?.rate ?? mgaRate;

  // preventivo: righe del foglio con importo (generali) + righe di progetto con importi DEMO
  const items = X.budget.filter((b) => b.code).map((b) => {
    let qty = b.qty ?? 1, eur = b.eur ?? 0, mga = b.mga;
    if (!b.tot) { const [lo, hi] = UNIT_COST[b.code!] ?? [20, 120]; qty = b.qty ?? Math.round(between(1, 12)); eur = Math.round(between(lo, hi)); mga = null; }
    const useMga = mga != null && mga > 0;
    return { prj: prjName(b.prj), dir: b.dir, code: b.code!, desc: b.desc, unit: b.unit ?? '', qty, cost: useMga ? mga! : eur,
      cur: useMga ? 'MGA' : 'EUR', rate: useMga ? String(X.rate_budget) : '', note: b.tot ? null : 'DEMO: importo inventato (nel foglio la riga non ha importo)',
      eurTot: useMga ? (qty * mga!) / X.rate_budget : qty * eur };
  }).filter((i) => i.qty > 0 && i.cost > 0);
  // entrate previste (DEMO, oltre alla riga reale «Donazioni singole»)
  const inc = [['E101', 'Donazioni da privati – campagna di Natale', 1, 9000], ['E104', 'Quote associative', 120, 30], ['E105', '5x1000', 1, 4200],
    ['E201', 'Contributo Fondazione Aurora – École Piccolino', 1, 18000], ['E202', 'Bando Comune di Monza – Sport & Inclusione', 1, 7500],
    ['E301', 'Cena di raccolta fondi', 2, 2500], ['E303', 'Crowdfunding Sapone Solidale', 1, 3000]] as const;
  for (const [code, desc, qty, cost] of inc)
    items.push({ prj: code === 'E201' ? 'École Piccolino' : code === 'E202' ? 'Sport & Inclusione' : code === 'E303' ? 'Sapone Solidale' : STRUCT, dir: 'in', code, desc, unit: '', qty, cost,
      cur: 'EUR', rate: '', note: 'DEMO: entrata prevista inventata', eurTot: qty * cost });

  // movimenti: per ogni riga di uscita del preventivo, spese mese per mese con scostamenti realistici
  const today = new Date().toISOString().slice(0, 10);
  const lastMonth = Math.min(12, +today.slice(0, 4) > year ? 12 : +today.slice(5, 7));
  const movements: Record<string, unknown>[] = [];
  const over = new Set(['École Piccolino|505', 'Spese generali|201', 'StreetFood|401']);      // righe che sforano (scostamenti)
  const under = new Set(['École Bonne Semence', 'Agricoltura']);                               // progetti in ritardo di spesa
  const supplierFor = (code: string) => code.startsWith('60') ? 'Jirama – energia e acqua (demo)' : code === '606' ? 'Telma Madagascar (demo)'
    : code === '201' ? 'Air Madagascar (demo)' : code === '202' || code === '206' ? 'Taxi-brousse Cotisse (demo)' : code === '303' ? 'Librairie Mixte Antananarivo (demo)'
    : code === '701' || code === '305' ? 'Studio Rossi commercialisti (demo)' : code === '503' || code === '505' ? 'Menuiserie Andry (demo)'
    : code === '401' ? pick(['Shoprite Ankorondrano (demo)', 'Quincaillerie Analakely (demo)']) : '';
  for (const it of items.filter((i) => i.dir === 'out')) {
    const k = `${it.prj}|${it.code}`;
    const factor = over.has(k) ? between(1.25, 1.45) : under.has(it.prj) ? between(0.25, 0.5) : between(0.55, 1.08);
    const annual = it.eurTot * factor * (lastMonth / 12);
    const n = Math.max(1, Math.min(lastMonth, it.unit === 'mese' ? lastMonth : Math.round(between(1, Math.min(6, lastMonth)))));
    const months = [...new Set(Array.from({ length: n }, (_, i) => (n >= lastMonth ? i + 1 : Math.ceil(R() * lastMonth))))].sort((a, b) => a - b);
    for (const m of months) {
      const eur = r2((annual / months.length) * between(0.85, 1.15));
      if (eur < 3) continue;
      const d = `${year}-${pad(m)}-${pad(Math.min(28, Math.ceil(R() * 28)))}`;
      const field = it.cur === 'MGA' || (it.prj !== STRUCT && R() < 0.8);
      const rate = rateOf(d);
      const acc = field ? pick(['Cassa Missione', 'Cassa Missione', 'Banca Missione', 'Mvola Telma']) : pick(['Banca Italia', 'Banca Italia', 'Paypal']);
      const mga = field && acc !== 'Banca Italia' && acc !== 'Paypal';
      const st = m === lastMonth && R() < 0.35 ? 'recorded' : m === lastMonth && R() < 0.12 ? 'draft' : 'verified';
      movements.push({ k: 'expense', st, d, de: `${it.desc}${months.length > 1 ? ` · ${['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'][m - 1]}` : ''}`,
        a: mga ? Math.round(eur * rate / 100) * 100 : eur, cur: mga ? 'MGA' : 'EUR', r: mga ? String(rate) : '', acc, code: it.code, prj: it.prj,
        cp: supplierFor(it.code), pm: acc === 'Cassa Missione' ? 'Contanti' : acc === 'Mvola Telma' ? 'Mobile money' : acc === 'Paypal' ? 'PayPal' : 'Bonifico',
        nd: R() < 0.72 ? 'DEMO: giustificativo non caricato (dato dimostrativo)' : null });
    }
  }
  // entrate: donazioni ricorrenti e una tantum
  for (let m = 1; m <= lastMonth; m++) {
    const d = (day: number) => `${year}-${pad(m)}-${pad(day)}`;
    movements.push({ k: 'income', st: 'verified', d: d(5), de: `Donazioni da privati · ${m}/${year}`, a: r2(between(450, 1400)), cur: 'EUR', acc: 'Banca Italia', code: 'E101', prj: STRUCT, cp: 'Donatori privati (demo)', pm: 'Bonifico', nd: 'DEMO' });
    if (R() < 0.6) movements.push({ k: 'income', st: 'verified', d: d(12), de: 'Donazioni online', a: r2(between(80, 420)), cur: 'EUR', acc: pick(['Paypal', 'Satispay']), code: 'E303', prj: STRUCT, cp: 'Donatori privati (demo)', pm: 'PayPal', nd: 'DEMO' });
    if (m === 3 || m === 4) movements.push({ k: 'income', st: 'verified', d: d(20), de: 'Quote associative', a: r2(between(1200, 1900)), cur: 'EUR', acc: 'Banca Italia', code: 'E104', prj: STRUCT, cp: '', pm: 'Bonifico', nd: 'DEMO' });
    if (m === 2 || m === 7) movements.push({ k: 'income', st: 'verified', d: d(15), de: `Contributo Fondazione Aurora – ${m === 2 ? 'prima' : 'seconda'} tranche`, a: 9000, cur: 'EUR', acc: 'Banca Italia', code: 'E201', prj: 'École Piccolino', cp: 'Fondazione Aurora (demo)', pm: 'Bonifico', nd: 'DEMO' });
    if (m === 5) movements.push({ k: 'income', st: 'verified', d: d(28), de: 'Bando Comune di Monza – acconto 60%', a: 4500, cur: 'EUR', acc: 'Banca Italia', code: 'E202', prj: 'Sport & Inclusione', cp: 'Comune di Monza (demo)', pm: 'Bonifico', nd: 'DEMO' });
    if (m === 6 || m === 11) movements.push({ k: 'income', st: 'verified', d: d(22), de: 'Cena di raccolta fondi', a: r2(between(1800, 3100)), cur: 'EUR', acc: 'Cassa Italia', code: 'E301', prj: STRUCT, cp: 'Parrocchia San Marco (demo)', pm: 'Contanti', nd: 'DEMO' });
    if (m === 10) movements.push({ k: 'income', st: 'verified', d: d(30), de: '5x1000 anno finanziario precedente', a: 3870.45, cur: 'EUR', acc: 'Banca Italia', code: 'E105', prj: STRUCT, cp: '', pm: 'Bonifico', nd: 'DEMO' });
    if (m === 9) movements.push({ k: 'income', st: 'recorded', d: d(18), de: 'Vendita sapone solidale al mercato', a: 1250000, cur: 'MGA', r: String(rateOf(d(18))), acc: 'Cassa Missione', code: 'E401', prj: 'Sapone Solidale', cp: '', pm: 'Contanti', nd: 'DEMO' });
    // rimesse in Madagascar e prelievi di contanti (giroconti)
    const r = rateOf(d(3));
    const eur = Math.round(between(5500, 8500) / 100) * 100;
    movements.push({ k: 'transfer', st: 'verified', d: d(3), de: `Rimessa mensile in Madagascar · ${m}/${year}`, a: eur, cur: 'EUR', acc: 'Banca Italia', to: 'Banca Missione', ta: Math.round(eur * r * 0.985), pm: 'Bonifico', nd: 'DEMO' });
    const cash = Math.round(between(12, 22)) * 1000000;
    movements.push({ k: 'transfer', st: 'verified', d: d(6), de: 'Prelievo contanti per la cassa', a: cash, cur: 'MGA', r: String(r), acc: 'Banca Missione', to: 'Cassa Missione', ta: cash, pm: 'Contanti', nd: 'DEMO' });
  }

  const deadlines = [
    { title: 'Rendicontazione intermedia Fondazione Aurora (demo)', cat: 'prj', d: `${year}-${pad(Math.min(12, lastMonth + 1))}-15`, prio: 'high', prj: 'École Piccolino' },
    { title: 'Saldo bando Comune di Monza: relazione finale (demo)', cat: 'prj', d: `${year}-12-20`, prio: 'normal', prj: 'Sport & Inclusione' },
    { title: 'Pagamento affitto sede Antananarivo (demo)', cat: 'pay', d: `${year}-${pad(lastMonth)}-28`, a: '1800000', cur: 'MGA', prio: 'normal' },
    { title: 'Rinnovo assicurazione mezzi (demo)', cat: 'pay', d: `${year}-${pad(Math.max(1, lastMonth - 1))}-10`, a: '420', cur: 'EUR', prio: 'normal', st: 'done' },
  ];

  const total = (dir: 'in' | 'out') => r2(items.filter((i) => i.dir === dir).reduce((s, i) => s + i.eurTot, 0));
  return {
    projects, counterparties, fx,
    budget: { year, title: `Preventivo ${year} · DEMO`, ref: `DEMO: righe generali dal foglio Excel del ${X.budget_date.split('-').reverse().join('/')}, righe di progetto con importi inventati`,
      items: items.map(({ eurTot: _e, ...i }) => i) },
    movements, deadlines,
    summary: { items: items.length, budgetOut: total('out'), budgetIn: total('in'), movements: movements.length },
  };
}
