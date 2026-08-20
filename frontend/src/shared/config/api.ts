/**
 * API route constants.
 *
 * The frontend and API share an origin in production (Nginx reverse-proxies
 * `/api/*` to the Go backend — see architecture.md §3 and §34), so these
 * stay relative rather than pointing at an absolute host.
 */
const API_PREFIX = '/api/v1';

/**
 * Starts the Google OpenID Connect flow (architecture.md §19, §34).
 * This is a full-page navigation, not a fetch — the backend redirects the
 * browser on to Google.
 */
export const GOOGLE_AUTH_URL = `${API_PREFIX}/auth/google`;

/** `POST` to end the session (architecture.md §20, §34). */
export const LOGOUT_URL = `${API_PREFIX}/auth/logout`;

/**
 * Who's currently signed in, per the session cookie (architecture.md
 * §20/§21) — 200 with `{ id, email, displayName, pictureUrl, isAdmin }`
 * if there's a valid session, 401 otherwise. This is what `shared/auth`
 * calls to decide whether `/cuenta`, `/biblioteca`, and `/admin/*` should
 * render or redirect to `/login`. Note: `/api/v1/me`, not
 * `/api/v1/auth/me` — it lives alongside `/api/v1/me/books`, not under
 * `/api/v1/auth/*` (see `router.go`).
 */
export const ME_URL = `${API_PREFIX}/me`;

/**
 * Protected eBook download (architecture.md §28) — never a direct file
 * URL. `bookId` is the book's slug here since the mock data has no
 * numeric id; the real endpoint takes whatever id the backend assigns.
 */
export function downloadUrl(bookId: string): string {
  return `${API_PREFIX}/books/${bookId}/download`;
}

/**
 * Creates an order and (per architecture.md §23) a Mercado Pago
 * preference to redirect to. A `success` redirect from this flow is
 * never treated as proof of payment on its own (§24) — only the
 * webhook-confirmed order status is.
 */
export const ORDERS_URL = `${API_PREFIX}/orders`;
