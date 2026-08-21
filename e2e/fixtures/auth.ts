// Logs a Playwright BrowserContext in as an already-seeded session
// (fixtures/db.ts's seedSession), instead of automating the real Google
// OAuth handshake — see README.md for why.
import type { BrowserContext } from '@playwright/test';
import type { SeededSession } from './db';

const SESSION_COOKIE_NAME = 'nmp_session';

export async function signInAs(context: BrowserContext, session: SeededSession): Promise<void> {
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: session.rawToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}
