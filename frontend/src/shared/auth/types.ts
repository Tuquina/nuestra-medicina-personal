/** Mirrors the backend's `userResponse` JSON shape exactly
 * (`backend/internal/interfaces/httpapi/auth_handler.go`). */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  pictureUrl: string;
  isAdmin: boolean;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'anonymous' };

/** First letters of up to the first two words of a display name — the
 * avatar initials shown when there's no `pictureUrl`. */
export function initialsFrom(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}
