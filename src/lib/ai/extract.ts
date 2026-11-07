import 'server-only';
import { parseToolInput, TOOL, type Extraction } from './schema';
export { buildPrompt, mockExtraction, runChecks } from './schema';

// Chiamata all'API Anthropic: solo dal server, con la chiave privata.
export async function callClaude(opts: {
  apiKey: string; model: string; prompt: string;
  file: { base64: string; mime: string };
}): Promise<{ extraction: Extraction; usage: { input_tokens: number; output_tokens: number } }> {
  const isPdf = opts.file.mime === 'application/pdf';
  const block = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: opts.file.base64 } }
    : { type: 'image', source: { type: 'base64', media_type: opts.file.mime, data: opts.file.base64 } };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 1500,
      temperature: 0,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [{ role: 'user', content: [block, { type: 'text', text: opts.prompt }] }],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    // nel log solo stato e messaggio d'errore dell'API (mai la chiave né il contenuto del documento)
    const err = await res.json().catch(() => null);
    console.error('[extract] API Anthropic', res.status, err?.error?.type ?? '', String(err?.error?.message ?? '').slice(0, 300));
    throw new Error(`ai_http_${res.status}`);
  }
  const body = await res.json();
  const tool = (body.content ?? []).find((c: { type: string }) => c.type === 'tool_use');
  if (!tool) { console.error('[extract] nessun tool_use, stop_reason:', body.stop_reason); throw new Error('ai_no_result'); }
  return { extraction: parseToolInput(tool.input), usage: body.usage ?? { input_tokens: 0, output_tokens: 0 } };
}
