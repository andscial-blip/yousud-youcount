import 'server-only';
import { parseToolInput, TOOL, type Extraction } from './schema';
export { buildPrompt, mockExtraction, runChecks } from './schema';

type Usage = { input_tokens: number; output_tokens: number };

// Chiamata all'API Anthropic: solo dal server, con la chiave privata.
// I modelli recenti non accettano tool_choice forzato ("tool"/"any"): si usa "auto" con l'istruzione
// esplicita di rispondere con lo strumento, e in ultima istanza si legge un JSON nel testo.
export async function callClaude(opts: {
  apiKey: string; model: string; prompt: string;
  file: { base64: string; mime: string };
}): Promise<{ extraction: Extraction; usage: Usage }> {
  const isPdf = opts.file.mime === 'application/pdf';
  const block = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: opts.file.base64 } }
    : { type: 'image', source: { type: 'base64', media_type: opts.file.mime, data: opts.file.base64 } };
  const request: Record<string, unknown> = {
    model: opts.model,
    max_tokens: 2000,
    temperature: 0,
    system: `Rispondi esclusivamente chiamando lo strumento ${TOOL.name}, una sola volta, senza testo aggiuntivo.`,
    tools: [TOOL],
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content: [block, { type: 'text', text: opts.prompt }] }],
  };

  let res = await post(opts.apiKey, request);
  if (res.status === 400 && /temperature/i.test(res.message)) {
    // alcuni modelli non accettano più temperature: si riprova senza
    delete request.temperature;
    res = await post(opts.apiKey, request);
  }
  if (!res.ok) {
    // nel log solo stato e messaggio d'errore dell'API (mai la chiave né il contenuto del documento)
    console.error('[extract] API Anthropic', res.status, res.type, res.message);
    throw new Error(`ai_http_${res.status}`);
  }
  const body = res.body;
  const content: { type: string; input?: unknown; text?: string }[] = body.content ?? [];
  const tool = content.find((c) => c.type === 'tool_use');
  let input = tool?.input;
  if (!input) {
    const text = content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n');
    const json = text.match(/\{[\s\S]*\}/);
    try { input = json ? JSON.parse(json[0]) : undefined; } catch { input = undefined; }
  }
  if (!input) { console.error('[extract] nessun risultato, stop_reason:', body.stop_reason); throw new Error('ai_no_result'); }
  return { extraction: parseToolInput(input), usage: body.usage ?? { input_tokens: 0, output_tokens: 0 } };
}

async function post(apiKey: string, request: Record<string, unknown>) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(55000),
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body, type: String(body?.error?.type ?? ''), message: String(body?.error?.message ?? '').slice(0, 300) };
}
