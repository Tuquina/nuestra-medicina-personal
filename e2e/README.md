# E2E tests

Playwright tests that drive the real dev stack (`docker-compose.yml` at the
repo root) through a real browser, with a fake Mercado Pago server standing
in for the real payment provider. Separate `package.json` from `frontend/`
on purpose — this is test tooling, not app build tooling.

## Running locally

```bash
cd e2e
npm install
npx playwright install --with-deps chromium   # once, downloads the browser
npm test
```

`global-setup.ts` brings up `docker compose -p nmp-e2e -f docker-compose.yml
-f e2e/docker-compose.e2e.yml` (see `fixtures/compose.ts`), waits for the
API health check, the frontend dev server, and the fake Mercado Pago
server, then hands off to the tests. `global-teardown.ts` tears the stack
down afterwards (`docker compose down -v`) — set `E2E_KEEP_STACK=1` to skip
that and leave everything running for manual inspection after a run. Set
`E2E_SKIP_COMPOSE=1` to skip *both* bringing the stack up and tearing it
down — useful when iterating on tests against a stack you're already
running yourself (`docker compose -p nmp-e2e -f docker-compose.yml -f
e2e/docker-compose.e2e.yml up -d --build`).

The explicit `-p nmp-e2e` project name matters: without it, Compose derives
the project name from the current directory, which is exactly what your
own plain `docker compose up` (the regular dev workflow, run from this same
repo root) also gets by default — the E2E stack would then reuse the dev
stack's containers *and named volumes*, and `global-teardown.ts`'s
`down -v` would delete your real Postgres data and uploaded files the next
time you ran this suite after using the regular dev workflow. `-p nmp-e2e`
keeps it in its own project namespace, entirely separate from your dev
stack, no matter what directory either runs from.

That only isolates the *data* — the two stacks still publish the same host
ports (5173, 8080, plus 5432 for Postgres and 9999 for the fake Mercado
Pago server, neither published by the base `docker-compose.yml` on its
own), so stop your own `docker compose up` (or any local Postgres on 5432)
before running this suite. Requires Docker and Node 20+. No real Google or
Mercado Pago credentials are ever used — see below.

## What's real and what's faked

**Real**: the actual frontend, the actual Go API, a real Postgres, the
actual webhook HMAC signature validation, the actual "independently verify
the payment with the provider" call (architecture.md §24) — just pointed at
a fake provider. Session/authorization enforcement (`requireUser`/
`requireAdmin`) runs exactly as it does in production.

**Faked, deliberately**:

- **Mercado Pago**: `docker-compose.e2e.yml` adds an `mp-fake` service (see
  `fixtures/mercadopago-fake-server.js`, plain Node `http`, no deps) that
  implements only the two calls the real client makes —
  `POST /checkout/preferences` and `GET /v1/payments/{id}` — and points the
  API at it via `MERCADOPAGO_API_BASE_URL` (see
  `backend/internal/infrastructure/mercadopago/client.go`). Tests control
  what a payment ID "means" via `POST http://localhost:9999/_control/payments/{id}`
  *before* triggering the webhook, so the whole verification path runs for
  real against a fake, controllable upstream.
- **Google login**: not automated at all. The real OIDC endpoints
  (`accounts.google.com`, `googleapis.com`) are hardcoded in
  `backend/internal/infrastructure/google/oidc.go` — pointing them at a
  mock would be a much bigger change than this test suite justifies (see
  ADR-style reasoning in the PR that added this). Instead, any test that
  needs to be "signed in as a user/admin" seeds a `users`+`sessions` row
  directly (`fixtures/db.ts`'s `seedSession()`) and injects the resulting
  `nmp_session` cookie into the browser context (`fixtures/auth.ts`'s
  `signInAs()`) — this exercises the real session-validation code, just
  skips the Google handshake itself, which is already covered by
  `backend/internal/application/authentication/service_test.go`.
  `tests/smoke.spec.ts` includes one lightweight check that
  `GET /api/v1/auth/google` really does redirect to `accounts.google.com`
  with a well-formed `state`/PKCE challenge, without following it.

## Fixtures (`fixtures/`)

- `db.ts` — seeds/cleans rows directly in Postgres (`seedSession`,
  `seedBook`, `seedCoupon`, `seedPaidOrder`, `cleanup`, plus the read-only
  `getOrderStatus`/`countPayments` helpers webhook tests assert against).
  Same rationale as the Go integration tests: known, deterministic fixtures
  beat trying to drive every precondition through the UI — `seedPaidOrder`
  in particular exists so library/review tests don't have to re-run the
  whole checkout-to-webhook pipeline just to get a paid order; that
  pipeline itself is `tests/purchase.spec.ts`'s job.
- `auth.ts` — `signInAs(context, session)` injects the `nmp_session`
  cookie from a seeded session.
- `http.ts` — `SAME_ORIGIN_HEADERS`, for tests that call a
  `requireSameOrigin`-guarded POST/PUT/DELETE directly instead of through
  the UI (which sets a real Origin header on its own).
- `mercadopago.ts` — drives the fake server's test-only control endpoints
  (`registerFakePayment`, `resetFakePayments`) and sends real, correctly
  HMAC-signed webhook requests (`sendWebhook`) — the signature math mirrors
  `webhook.go`'s `Validate()` exactly. `nextFakePaymentId()` hands out
  numeric ids, because the real client decodes a payment's `id` as
  `json.Number` (a bare JSON number, not a quoted string).
- `mercadopago-fake-server.js` — the fake payment provider described
  above.
- `compose.ts` — the one place `docker compose` gets invoked from
  (`global-setup.ts`/`global-teardown.ts` both import it), so the project
  name (`-p nmp-e2e`, see above) can never drift between the two.

Every test that seeds fixtures is responsible for cleaning them up
(`try { ... } finally { await cleanup(...) }`) — tests run against one
shared stack/database instance (`fullyParallel: false`, `workers: 1` in
`playwright.config.ts`), so leftover rows from a failed cleanup would leak
into the next test.

## Tests (`tests/`)

Phase 1 (`smoke.spec.ts`) only proves the harness itself works. Phase 2
covers the actual purchase/webhook/library/review business flows, one file
per area:

- `purchase.spec.ts` — the checkout pipeline: a real UI-driven happy path
  (catalog → checkout → a real, fake-upstream Mercado Pago webhook →
  biblioteca), plus the coupon validation rules checkout applies before
  ever creating an order (valid/nonexistent/expired/wrong-book/currency
  mismatch — see PR #9).
- `webhook.spec.ts` — the webhook endpoint on its own: invalid signature
  rejected, a payment that doesn't match any local order ignored silently
  (by design — see `order.ErrNotFound`/`ErrPaymentMismatch` handling in
  `orders_handler.go`), and a pending-then-approved payment transitioning
  the order without duplicating the payment row on a retried delivery.
- `library.spec.ts` — access control on `/api/v1/me/books` and
  `/api/v1/books/{id}/download`: anonymous, authenticated-but-never-bought,
  and the actual owner.
- `reviews.spec.ts` — a purchase is required to review; a new review stays
  `PENDING` and invisible on the public book page until an admin approves
  it.

## CI

The `e2e` job in `.github/workflows/ci.yml` runs this suite after the
`backend`/`frontend` jobs pass, using the exact same `docker compose`
invocation as local runs (no separate CI-only path to keep in sync).
