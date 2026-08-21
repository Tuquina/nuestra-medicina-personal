// requireSameOrigin (backend/internal/interfaces/httpapi/middleware.go) checks
// the Origin header on every non-GET request against APP_BASE_URL, which
// defaults to this same address in both plain local dev and
// docker-compose.e2e.yml (neither overrides it) — matching
// playwright.config.ts's own baseURL. Playwright's `request`/`context.request`
// fixtures don't set a browser-like Origin header automatically the way a
// real <form>/fetch() submission from a loaded page would, so any test that
// calls a requireSameOrigin-guarded POST/PUT/DELETE directly (bypassing the
// UI) needs to pass this explicitly.
export const SAME_ORIGIN_HEADERS = { Origin: process.env.E2E_BASE_URL ?? 'http://localhost:5173' };
