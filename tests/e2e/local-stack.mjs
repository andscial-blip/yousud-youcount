// SOLO PER I TEST LOCALI. Simula l'endpoint di un progetto Supabase su http://localhost:3400:
//   /rest/v1/*  → PostgREST (stesso motore usato da Supabase) collegato al database di prova
//   /auth/v1/*  → finto servizio di accesso: password unica di prova, JWT firmati con il segreto locale
// Così l'app Next.js gira senza modifiche contro le vere migrazioni, RLS e funzioni del database.
// Uso: node tests/e2e/local-stack.mjs  (richiede PostgREST in $POSTGREST_BIN e il DB preparato)
import http from 'node:http';
import { createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';

export const JWT_SECRET = 'local-test-secret-local-test-secret-0123456789';
export const TEST_PASSWORD = 'prova-locale';
const DB = process.env.DATABASE_URL ?? 'postgres://tester:tester@localhost:5432/mizana_test';
const PORT = Number(process.env.STACK_PORT ?? 3400);
const PGRST_PORT = PORT + 1;

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
export function sign(payload) {
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64(payload);
  return `${h}.${p}.${createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url')}`;
}
function verify(token) {
  const [h, p, s] = String(token).split('.');
  if (!s || createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url') !== s) return null;
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  return claims.exp && claims.exp < Date.now() / 1000 ? null : claims;
}
export const ANON_KEY = sign({ role: 'anon', iss: 'local', exp: 4102444800 });

const pool = new pg.Pool({ connectionString: DB, max: 2 });
async function userBy(field, value) {
  const { rows } = await pool.query(`select id, email, raw_app_meta_data, raw_user_meta_data, created_at
                                     from auth.users where ${field} = $1`, [value]);
  return rows[0];
}
const userJson = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
  app_metadata: u.raw_app_meta_data, user_metadata: u.raw_user_meta_data, created_at: u.created_at });
// amr come Supabase: metodo e ora dell'accesso (con password: adesso; rinnovo del token: un'ora fa)
function session(u, method = 'password', ago = 0) {
  const now = Math.floor(Date.now() / 1000), exp = now + 3600;
  return { access_token: sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, exp, amr: [{ method, timestamp: now - ago }] }),
           token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: `r.${u.id}`, user: userJson(u) };
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}
function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

const USED_TOKENS = new Set();
async function auth(req, res, url) {
  const path = url.pathname.replace('/auth/v1', '');
  if (req.method === 'POST' && path === '/token') {
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    const grant = url.searchParams.get('grant_type');
    let u;
    if (grant === 'password' && body.password === TEST_PASSWORD) u = await userBy('lower(email)', String(body.email).toLowerCase());
    if (grant === 'refresh_token' && String(body.refresh_token).startsWith('r.')) u = await userBy('id', body.refresh_token.slice(2));
    return u ? send(res, 200, grant === 'password' ? session(u) : session(u, 'password', 3600)) : send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
  }
  if (req.method === 'GET' && path === '/user') {
    const claims = verify((req.headers.authorization ?? '').replace(/^Bearer /, ''));
    const u = claims?.sub && (await userBy('id', claims.sub));
    return u ? send(res, 200, userJson(u)) : send(res, 401, { msg: 'invalid JWT' });
  }
  // link delle email con token_hash (modelli personalizzati): "th.<id utente>", valido una sola volta
  if (req.method === 'POST' && path === '/verify') {
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    const th = String(body.token_hash ?? '');
    const u = th.startsWith('th.') && !USED_TOKENS.has(th) && (await userBy('id', th.slice(3)));
    if (!u) return send(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Email link is invalid or has expired' });
    USED_TOKENS.add(th);
    return send(res, 200, session(u));
  }
  if (path === '/logout') return send(res, 204);
  return send(res, 404, { msg: 'not implemented in local stack' });
}

// finto Storage: tiene i file in memoria; basta per caricare un giustificativo e aprirlo con un link firmato
const FILES = new Map();
async function storage(req, res, url) {
  const p = decodeURIComponent(url.pathname.replace('/storage/v1', ''));
  const auth = verify((req.headers.authorization ?? '').replace(/^Bearer /, ''));
  if (req.method === 'GET' && p.startsWith('/object/sign/')) {
    const f = FILES.get(p.slice('/object/sign/'.length));
    if (!f) return send(res, 404, { error: 'not found' });
    res.writeHead(200, { 'content-type': f.type });
    return res.end(f.buf);
  }
  if (!auth || auth.role !== 'authenticated') return send(res, 403, { error: 'unauthorized' });
  if (req.method === 'POST' && p.startsWith('/object/sign/')) {
    const rest = p.slice('/object/sign/'.length);
    const body = JSON.parse((await readBody(req)).toString() || '{}');
    if (Array.isArray(body.paths)) {
      return send(res, 200, body.paths.map((path) => ({ path, error: FILES.has(`${rest}/${path}`) ? null : 'not found',
        signedURL: `/object/sign/${rest}/${path}?token=locale` })));
    }
    return send(res, 200, { signedURL: `/object/sign/${rest}?token=locale` });
  }
  if (req.method === 'POST' && p.startsWith('/object/')) {
    const key = p.slice('/object/'.length);
    if (FILES.has(key)) return send(res, 409, { error: 'Duplicate', message: 'The resource already exists' });
    FILES.set(key, { buf: await readBody(req), type: req.headers['content-type'] ?? 'application/octet-stream' });
    return send(res, 200, { Key: key, Id: key });
  }
  return send(res, 404, { msg: 'not implemented in local stack' });
}

function proxyRest(req, res, url) {
  const up = http.request({ host: '127.0.0.1', port: PGRST_PORT, method: req.method,
    path: url.pathname.replace('/rest/v1', '') + url.search,
    headers: { ...req.headers, host: `127.0.0.1:${PGRST_PORT}` } }, (r) => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.on('error', (e) => send(res, 502, { msg: e.message }));
  req.pipe(up);
}

export async function startStack() {
  const u = new URL(DB);
  const pgrst = spawn(process.env.POSTGREST_BIN ?? '/home/claude/tools/pgrst/postgrest', [], {
    env: { ...process.env,
      PGRST_DB_URI: `postgres://authenticator:authenticator@${u.host}${u.pathname}`,
      PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: JWT_SECRET,
      PGRST_SERVER_PORT: String(PGRST_PORT), PGRST_LOG_LEVEL: 'error' },
    stdio: ['ignore', 'inherit', 'inherit'] });
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
                           'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' });
      return res.end();
    }
    if (url.pathname.startsWith('/auth/v1')) return auth(req, res, url).catch((e) => send(res, 500, { msg: e.message }));
    if (url.pathname.startsWith('/rest/v1')) return proxyRest(req, res, url);
    if (url.pathname.startsWith('/storage/v1')) return storage(req, res, url).catch((e) => send(res, 500, { msg: e.message }));
    send(res, 404, {});
  });
  await new Promise((r) => server.listen(PORT, r));
  for (let i = 0; i < 50; i++) {             // attende PostgREST
    const ok = await fetch(`http://127.0.0.1:${PGRST_PORT}/`, { headers: { apikey: ANON_KEY } }).then(() => true, () => false);
    if (ok) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  return { url: `http://localhost:${PORT}`, anonKey: ANON_KEY,
           files: FILES, stop: async () => { pgrst.kill(); server.close(); await pool.end(); } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await startStack();
  console.log(`stack locale su ${s.url}\nNEXT_PUBLIC_SUPABASE_URL=${s.url}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${s.anonKey}`);
}
