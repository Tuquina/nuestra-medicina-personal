/**
 * Fixed reference "now" for every admin mock dataset (sales, book
 * updated-at timestamps, …) — not the real system clock, so relative
 * labels ("Hace 2 días") read sensibly regardless of when this is
 * actually opened. Swap for the server's clock once real data exists.
 */
export const ADMIN_NOW = new Date('2026-08-18');
