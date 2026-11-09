import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

// Esporta il pacchetto dei dati DEMO (gli stessi del pulsante «Carica i dati dimostrativi»), così che il caricamento
// si possa fare anche dal database. È spento di norma: risponde solo se la variabile DEMO_EXPORT_TOKEN è impostata
// e la richiesta porta lo stesso valore nell'intestazione x-demo-token. Non scrive nulla e non legge dati reali.
export const dynamic = 'force-dynamic';

const h = (s: string) => createHash('sha256').update(s).digest();

export async function GET(req: Request) {
  const want = process.env.DEMO_EXPORT_TOKEN;
  const got = req.headers.get('x-demo-token') ?? '';
  if (!want || want.length < 32 || !timingSafeEqual(h(want), h(got))) return new NextResponse('Not found', { status: 404 });
  const { buildDemo } = await import('@/lib/demo/build');
  return NextResponse.json(buildDemo(new Date().getFullYear()), { headers: { 'cache-control': 'no-store' } });
}
