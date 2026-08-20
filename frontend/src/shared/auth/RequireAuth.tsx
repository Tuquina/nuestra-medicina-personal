import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';
import { AuthLoading } from '../components/AuthLoading/AuthLoading';

/**
 * Route guard for pages that represent a logged-in area (`/cuenta`,
 * `/biblioteca`) — redirects to `/login` when there's no session. Purely
 * a UX nicety, not the security boundary: see `AuthContext.tsx`'s doc
 * comment. Use as a layout route: `<Route element={<RequireAuth />}>…`.
 */
export function RequireAuth() {
  const auth = useAuth();

  if (auth.status === 'loading') return <AuthLoading />;
  if (auth.status === 'anonymous') return <Navigate to="/login" replace />;

  return <Outlet />;
}
