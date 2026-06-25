---
name: run-deyanira-web
description: Build, launch, smoke-test, and screenshot the Deyanira Makeup Beauty web app (Next.js web :3000 + Express API :3001 monorepo). Use when asked to run, start, boot, serve, smoke-test, screenshot, or drive the app / admin panel / booking flow locally.
---

# Run Deyanira Makeup Beauty

npm-workspaces monorepo with two long-running processes that run together:
**`apps/web`** (Next.js 14, port **3000**) and **`apps/api`** (Express, port
**3001**, Prisma → Supabase/Postgres). The web UI calls the API. Two driving
surfaces, both exercised this session:

- **API / server** → committed zero-dep smoke script
  `.claude/skills/run-deyanira-web/smoke.mjs` (Node global `fetch`).
- **Browser UI** → the **Playwright MCP tools** (`browser_navigate`,
  `browser_take_screenshot`). There is no `chromium-cli` on this machine.

All paths below are relative to the repo root (`<unit>/`). Verified on
**Windows 11**, Node v22.14, Git Bash. Commands work in Git Bash and
PowerShell unless noted.

## Prerequisites

- **Node ≥ 18** (uses global `fetch`; verified on v22.14). npm 10.
- No OS packages, no browser install needed for the smoke script.
- Browser UI driving uses the Playwright MCP server (already available in
  this agent environment).

## Setup / Build

```bash
npm install                 # root install hoists all workspaces
```

Environment files must exist (they hold live Supabase/Culqi/Resend creds):

- Root **`.env`** — read by the API and root scripts (`DATABASE_URL`,
  `DIRECT_URL`, `SUPABASE_URL`, `ADMIN_JWT_SECRET`, …). Copy `.env.example`.
- **`apps/web/.env.local`** — read by Next.js for its `NEXT_PUBLIC_*` vars
  (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, …).

Generate the Prisma client **before** starting the API (see Gotchas — it
fails if the API is already running on Windows):

```bash
npm run db:generate
```

## Run (agent path) — servers

`npm run dev` runs **both** servers in parallel (web :3000 + api :3001).
Run it in the background; it never exits on its own.

```bash
npm run dev          # both; or: npm run dev:web / npm run dev:api
```

The servers are often **already running** in this workspace. Don't relaunch
blindly — check first, then smoke:

```bash
# already-up check (Git Bash)
netstat -ano | grep -E ':3000|:3001' | grep LISTENING

# smoke both servers + the public DB-backed API (exit 0 = all green)
node .claude/skills/run-deyanira-web/smoke.mjs
```

Expected tail:

```
PASS — all checks green
```

The smoke script hits `GET /` on web and `/api/health`, `/api/services`,
`/api/event-types`, `/api/staff`, `/api/products`, `/api/gallery`,
`/api/blog` on the API. A green run proves the API is wired to a live DB
(those endpoints return JSON arrays of real rows). Override targets with
`WEB_URL` / `API_URL` env vars.

## Run (agent path) — browser UI + screenshots

Drive the actual UI with the **Playwright MCP tools**. This session's exact,
working sequence (home page → screenshot on disk):

```
mcp__playwright__browser_navigate   { "url": "http://localhost:3000/" }
mcp__playwright__browser_take_screenshot { "type": "png", "filename": "deyanira-home.png" }
```

The screenshot lands in the Playwright MCP output dir (repo root as
`deyanira-home.png` here); move it where you want with `mv`. Reference shots
captured this session live in
`.claude/skills/run-deyanira-web/shots/` (`deyanira-home.png`,
`deyanira-admin-login.png`).

Useful routes (all render):
- `/` — public home (hero carousel, "Reservar cita").
- `/reservar` — booking wizard (the BookingWizard flow).
- `/admin/login` — admin panel login ("Panel Admin"). Admin uses a custom
  JWT stored in localStorage, not Supabase — there is no server-side guard,
  so navigating straight to `/admin/login` works.

## Run (human path)

`npm run dev`, then open http://localhost:3000 in a browser. Stop with
Ctrl-C. Headless agents can't see the window — use the smoke script +
Playwright MCP above instead.

## Test

```bash
cd apps/api && npx vitest run            # full API unit suite (vitest)
cd apps/api && npx vitest run src/modules/appointments   # scoped (52 tests, ~1s, verified)
```

Type-check without touching `.next` (safe while dev is running):

```bash
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit          # NOTE: web has known pre-existing errors
```

## Gotchas

- **`npm run db:generate` fails with `EPERM … rename query_engine-windows.dll.node`
  while the API is running.** Windows locks the loaded Prisma engine DLL.
  Run `db:generate` *before* `npm run dev:api`, or stop the API first. If the
  API is already serving DB data, the client is already generated — skip it.
- **Never run `npm run build` while `npm run dev` is active.** It overwrites
  `apps/web/.next` and breaks the running dev server (MIME errors, 404 chunks,
  500 manifest). Recovery: stop dev, `rm -rf apps/web/.next`, restart dev. Use
  `npx tsc --noEmit` to validate types instead of building.
- **`apps/web` needs `.env.local`, not root `.env`.** Next prints
  `Environments: .env.local` on boot. Missing `NEXT_PUBLIC_*` there → the web
  app loads but API calls/auth silently misbehave.
- **API has no root route** — `GET http://localhost:3001/` is **404 by design**.
  Health is `GET /api/health` → `{"status":"ok",...}`. Don't use `/` as an
  up-check.
- **`/api/settings` and `/api/promotions` return 404 at their bare path**
  (they only expose sub-paths). Use `/api/services` etc. as liveness probes —
  that's what `smoke.mjs` does.
- **Home page console shows two 404s** for `/icons/apple-touch-icon.png` and
  `/icons/icon-192.png` (missing PWA icons). Harmless — not a launch failure.
- **`next dev` spawns child processes.** Killing the parent PID frees the port
  after ~1–2s; re-check with `netstat … grep :3000` before relaunching.

## Troubleshooting

- `smoke.mjs` → `ECONNREFUSED` / `TimeoutError`: that server isn't up. Start it
  with `npm run dev` (or `dev:web`/`dev:api`) and re-run.
- `GET /api/services` returns non-array / 500: API is up but the DB/Prisma
  connection is broken — check `DATABASE_URL`/`DIRECT_URL` in root `.env` and
  that `npm run db:generate` succeeded.
- Port already in use on launch: a previous dev server is still bound. Find it
  with `netstat -ano | grep ':3000'` and stop that PID.
