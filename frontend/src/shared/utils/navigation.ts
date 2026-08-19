/**
 * A full-page navigation (leaves the SPA entirely) — for handing off to
 * an external redirect target like Mercado Pago's checkout URL. Kept as
 * a plain function outside any component/hook so the mutation isn't
 * flagged by the React Compiler's immutability lint rule, which
 * (correctly) objects to assigning `window.location` from inside
 * component/hook bodies.
 */
export function hardNavigate(url: string): void {
  window.location.href = url;
}
