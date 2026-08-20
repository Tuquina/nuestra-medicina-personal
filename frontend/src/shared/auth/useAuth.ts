import { createContext, useContext } from 'react';
import type { AuthState } from './types';

/**
 * Who's signed in, fetched once per app load from `GET /api/v1/me`
 * (the session cookie, if any, goes along automatically — architecture.md
 * §20). This is a **UX** convenience only: it decides what the frontend
 * shows (redirect to `/login`, hide the admin sidebar, …), never a
 * security boundary. The backend's `requireAdmin`/`requireUser`
 * middleware (architecture.md §21: "nunca confiar en ocultar componentes
 * del frontend") is what actually protects every `/api/v1/admin/*` and
 * user-scoped request — this context could report `authenticated` and a
 * spoofed request would still get rejected server-side, and vice versa.
 *
 * Split into its own file (rather than living in `AuthContext.tsx`
 * alongside `AuthProvider`) because a file that exports both a component
 * and a plain function breaks Fast Refresh. Named `useAuth.ts` rather
 * than `authContext.ts` because that name differs from `AuthContext.tsx`
 * only in casing, which trips up case-insensitive filesystems (Windows,
 * some Docker volume mounts) even though the extensions differ.
 */
export const AuthContext = createContext<AuthState>({ status: 'loading' });

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
