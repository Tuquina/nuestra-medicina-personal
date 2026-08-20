import { Link, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';
import { AuthLoading } from '../components/AuthLoading/AuthLoading';
import styles from './RequireAdmin.module.css';

/**
 * Route guard for `/admin/*` — redirects to `/login` when there's no
 * session, and shows a plain "no autorizado" message (rather than
 * silently rendering the admin UI) when the signed-in user isn't an
 * admin. Purely a UX nicety, not the security boundary: the backend's
 * `requireAdmin` middleware (architecture.md §21) is what actually
 * enforces this on every `/api/v1/admin/*` request — hiding the sidebar
 * here doesn't protect anything on its own. Use as a layout route:
 * `<Route path="/admin" element={<RequireAdmin />}>…`.
 */
export function RequireAdmin() {
  const auth = useAuth();

  if (auth.status === 'loading') return <AuthLoading />;
  if (auth.status === 'anonymous') return <Navigate to="/login" replace />;

  if (!auth.user.isAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.title}>No tenés permisos de administrador</p>
          <p className={styles.text}>
            Iniciaste sesión como {auth.user.email}, pero esta cuenta no tiene acceso al panel de administración.
          </p>
          <Link className={styles.link} to="/">
            Volver al sitio
          </Link>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
