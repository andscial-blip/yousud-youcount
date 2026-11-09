// Tempi di apertura misurati nel browser (solo numeri, nessun dato personale): finiscono nei log di
// Vercel come riga «perf», per capire dove si perde tempo sui dispositivi reali.
const KEYS = ['ttfb', 'html', 'dom', 'fcp', 'load', 'splash', 'boot'] as const;

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > 2000) return new Response(null, { status: 413 });
    const j = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of KEYS) if (typeof j[k] === 'number' && Number.isFinite(j[k])) out[k] = Math.round(j[k] as number);
    if (typeof j.path === 'string') out.path = j.path.slice(0, 60).replace(/[0-9a-f-]{36}/g, ':id');
    if (typeof j.sw === 'boolean') out.sw = j.sw;
    if (typeof j.net === 'string') out.net = j.net.slice(0, 10);
    const ua = req.headers.get('user-agent') ?? '';
    out.dev = /iPhone/.test(ua) ? 'iphone' : /iPad/.test(ua) ? 'ipad' : /Android/.test(ua) ? 'android' : /Macintosh/.test(ua) ? 'mac' : 'altro';
    out.pwa = j.pwa === true;
    console.log('perf', JSON.stringify(out));
  } catch { /* misura non valida: ignorata */ }
  return new Response(null, { status: 204 });
}
