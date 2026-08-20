import { useEffect, useState, type ReactNode } from 'react';
import { ME_URL } from '../config/api';
import type { AuthState } from './types';
import { AuthContext } from './useAuth';

/** Fetches `GET /api/v1/auth/me` once per app load and makes the result
 * available to `useAuth()` (see `authContext.ts` for what this state is
 * and — importantly — isn't). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetch(ME_URL, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error(`GET ${ME_URL} → ${response.status}`);
        return response.json();
      })
      .then((user) => {
        if (!cancelled) setState({ status: 'authenticated', user });
      })
      .catch(() => {
        // Covers both a real 401 (no session) and the endpoint not being
        // reachable yet — either way, treat the visitor as signed out
        // rather than blocking the whole app on a backend that may not
        // exist in every environment.
        if (!cancelled) setState({ status: 'anonymous' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
