# AGENTS.md — Nuestra Medicina Personal

Instructions for AI coding agents (Claude, Codex, or others) working in this
repository. Read this before making non-trivial changes.

## Read first

- [`docs/architecture.md`](docs/architecture.md) — the architectural source
  of truth. Read the relevant section before touching auth, payments,
  storage, the page builder, or infrastructure.
- [`docs/design-system.md`](docs/design-system.md) — design tokens and
  component conventions. Don't hardcode colors/spacing/fonts; use the
  tokens in `frontend/src/design-system/tokens.css`.
- [`docs/frontend-plan.md`](docs/frontend-plan.md) — which mockup maps to
  which route/component, and what's built vs. pending. Update it whenever
  you finish or start a page.

## Project shape

This is a small, single-owner eBook store — not a SaaS, not a
marketplace. Keep solutions proportional to ~5 visits/day and ~5 books.
Do not introduce infrastructure or abstractions to solve problems this
project doesn't have.

```text
frontend/   React + Vite + TypeScript SPA (public store + admin backoffice)
backend/    Go API (not started yet)
migrations/ SQL migrations (not started yet)
deploy/     docker-compose.yml + Nginx config for production (not started yet)
docs/       architecture.md, design-system.md, frontend-plan.md, ADRs
```

`docker-compose.yml` at the repo root is **dev-only** (runs the Vite dev
server in a container). It is not the production stack described in
architecture.md §3 — that belongs under `deploy/` once the backend exists.

## Hard rules

- **Do not change the stack** (React+Vite, Go, PostgreSQL, Nginx, Google
  OIDC, Mercado Pago Checkout Pro) without writing an ADR under
  `docs/decisions/` and getting it confirmed first.
- **No new dependencies "just in case."** Every new package needs a
  concrete reason tied to a task at hand.
- **No microservices, no Redis/Kafka/queues** unless a real, measured
  requirement shows up. This app runs on a 1 vCPU / 1 GB droplet.
- **Every DB schema change is a migration** under `migrations/`. Never
  hand-edit a production schema.
- **Every `/api/v1/admin/*` route must check authorization server-side.**
  Never rely on hiding a frontend route/component as the only guard.
- **Never expose eBook files via a public URL.** Downloads go through
  `GET /api/v1/books/{id}/download`, which validates the purchase, then
  streams via Nginx `X-Accel-Redirect` (architecture.md §28).
- **Payment webhooks must be idempotent** and must independently verify
  the payment with Mercado Pago — never trust `status`/`amount` fields
  from the raw webhook payload alone (architecture.md §24).
- **Never use `float` for money.** Minor units (`BIGINT`) or `NUMERIC`
  with explicit scale (architecture.md §38). Orders store the *historical*
  price of each item, not a live reference to the book's current price.
- **Orders and Payments are separate entities.** Don't collapse them
  (architecture.md §26).
- **Rich text in the Page Builder is never raw HTML.** Render from a
  constrained, sanitized structure only (architecture.md §40).
- **Sessions, not JWT**, for the web app's own auth (architecture.md §20).
- Keep `.env` out of the repo; extend `.env.example` when adding a
  variable.

## Frontend conventions

- One folder per component/page: `ComponentName/ComponentName.tsx` +
  `ComponentName.module.css`. No inline `style={{ ... }}` for anything
  that's already a token — pull from `design-system/tokens.css`.
- New pages live under `src/public-store/pages/` or `src/admin/pages/`.
  Shared, reusable pieces go in `src/shared/components/`.
- There's no real auth yet. Pages that represent a logged-in area (Mi
  Cuenta, Biblioteca) import the mock `CURRENT_USER` from
  `public-store/data/currentUser.ts` and pass it to `SiteHeader`'s `user`
  prop; everything else leaves it unset. Don't invent a fake login/logout
  flow beyond that — actions that need a real backend (logout, account
  deletion) call the real `/api/v1/...` endpoint from architecture.md §34
  and are left to fail gracefully until that endpoint exists, same as the
  Google login button.
- When implementing a new mockup (`*.dc.html` file from a Claude Design
  handoff bundle), **read the whole file**, translate inline styles to
  tokens/CSS Modules, and match the visual output — don't copy the
  prototype's `x-dc`/`dc-runtime` markup structure verbatim; that's
  design-tool scaffolding, not app code.
- Run `npm run build` and `npm run lint` (or the Docker equivalents —
  no local Node install is assumed) before considering a page done.

## Verifying without a local Node install

This environment may not have Node/npm installed. Use Docker instead:

```bash
docker compose up            # dev server at http://localhost:5173
docker run --rm -v "$(pwd)/frontend":/app -w /app node:20-alpine \
  sh -c "npm install && npm run build && npm run lint"
```

## Commits

Plain, descriptive commit messages. No AI co-author trailers.
