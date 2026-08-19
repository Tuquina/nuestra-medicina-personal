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
