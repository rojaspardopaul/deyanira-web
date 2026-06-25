#!/usr/bin/env node
// Smoke driver for the Deyanira web app (api :3001 + web :3000).
// Zero dependencies — uses Node 18+ global fetch. Run with: node smoke.mjs
// Exits 0 if both servers are up and the public API serves data; 1 otherwise.
//
// This is the AGENT path for the *server/API* surface. For driving the
// browser UI (clicking, screenshots) use the Playwright MCP tools — see
// SKILL.md "Run (agent path) — browser".

const WEB = process.env.WEB_URL || 'http://localhost:3000';
const API = process.env.API_URL || 'http://localhost:3001';
const TIMEOUT_MS = 20000;

let failures = 0;
const pass = (m) => console.log(`  ok   ${m}`);
const fail = (m) => { console.log(`  FAIL ${m}`); failures++; };

async function get(url) {
  const ctl = AbortSignal.timeout(TIMEOUT_MS);
  const res = await fetch(url, { signal: ctl, redirect: 'manual' });
  const body = await res.text();
  return { status: res.status, body, ct: res.headers.get('content-type') || '' };
}

async function check(label, url, assert) {
  try {
    const r = await get(url);
    const why = assert(r);
    if (why) fail(`${label} (${url}) — ${why}`);
    else pass(`${label} -> HTTP ${r.status}`);
  } catch (e) {
    fail(`${label} (${url}) — ${e.code || e.name}: ${e.message}`);
  }
}

const isArray = (r) => {
  if (r.status !== 200) return `expected 200, got ${r.status}`;
  try { if (!Array.isArray(JSON.parse(r.body))) return 'body is not a JSON array'; }
  catch { return 'body is not valid JSON'; }
  return null;
};

console.log(`\nDeyanira smoke — web=${WEB} api=${API}\n`);

console.log('Web (Next.js :3000)');
await check('home page', `${WEB}/`, (r) =>
  r.status !== 200 ? `expected 200, got ${r.status}`
  : !/<html/i.test(r.body) ? 'no <html> in body' : null);

console.log('\nAPI (Express :3001)');
await check('health', `${API}/api/health`, (r) =>
  r.status !== 200 ? `expected 200, got ${r.status}`
  : !/"status"\s*:\s*"ok"/.test(r.body) ? `health not ok: ${r.body.slice(0, 120)}` : null);

// Public catalog endpoints that read from the DB (Supabase/Postgres).
// A 200 JSON array here proves the API is wired to a live database.
for (const p of ['services', 'event-types', 'staff', 'products', 'gallery', 'blog']) {
  await check(`GET /api/${p}`, `${API}/api/${p}`, isArray);
}

console.log(`\n${failures === 0 ? 'PASS — all checks green' : `FAIL — ${failures} check(s) failed`}\n`);
process.exit(failures === 0 ? 0 : 1);
