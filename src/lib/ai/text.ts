import 'server-only';

// Chiamata testuale all'API Anthropic (traduzioni, domande sui dati): solo dal server, con la chiave privata.
export async function callText(opts: { apiKey: string; model: string; system: string; prompt: string; maxTokens?: number }): Promise<string> {
  const request: Record<string, unknown> = {
    model: opts.model, max_tokens: opts.maxTokens ?? 1500, system: opts.system,
    messages: [{ role: 'user', content: [{ type: 'text', text: opts.prompt }] }],
  };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(55000),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('[ai] API Anthropic', r.status, String(body?.error?.type ?? ''), String(body?.error?.message ?? '').slice(0, 200));
    throw new Error(`ai_http_${r.status}`);
  }
  return ((body.content ?? []) as { type: string; text?: string }[]).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n').trim();
}

export const FAST_MODEL = () => process.env.AI_MODEL_FAST || 'claude-haiku-5-5';
export const MAIN_MODEL = () => process.env.AI_MODEL || 'claude-sonnet-5-5';
