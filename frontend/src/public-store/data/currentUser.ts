/**
 * Mock signed-in user. There's no real session yet (no backend, no
 * Google OIDC — architecture.md §19/§20) so this stands in for whatever
 * `GET /api/v1/me` will eventually return, purely so the "logged in"
 * states (Mi Cuenta, Biblioteca, the header avatar) have something real
 * to render instead of being skipped.
 *
 * Pages that represent a logged-in area import this directly; pages that
 * don't (Home, Catálogo, …) leave `SiteHeader`'s `user` prop unset and
 * get the logged-out "Iniciar sesión" state.
 */
export interface CurrentUser {
  name: string;
  email: string;
  initials: string;
}

export const CURRENT_USER: CurrentUser = {
  name: 'María Álvarez',
  email: 'maria.alvarez@gmail.com',
  initials: 'MA',
};
