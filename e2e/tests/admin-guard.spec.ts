// Phase 3: the admin boundary itself. The frontend's RequireAdmin guard is
// "purely a UX nicety" (its own doc comment) — the real security boundary
// is the backend's requireAdmin middleware, so this covers both: the API
// rejecting a non-admin, and the UI showing the "no autorizado" message
// instead of silently rendering the admin panel.
import { test, expect } from '@playwright/test';
import { seedSession, cleanup } from '../fixtures/db';
import { signInAs } from '../fixtures/auth';

test.describe('límite de administración', () => {
  test('la API rechaza a un usuario autenticado que no es admin', async ({ context }) => {
    const session = await seedSession('user');
    try {
      await signInAs(context, session);
      const response = await context.request.get('/api/v1/admin/books');
      expect(response.status()).toBe(403);
      expect((await response.json()).error.code).toBe('ADMIN_REQUIRED');
    } finally {
      await cleanup({ userIds: [session.userId] });
    }
  });

  test('la API rechaza a quien no tiene sesión en absoluto', async ({ request }) => {
    const response = await request.get('/api/v1/admin/books');
    expect(response.status()).toBe(401);
  });

  test('el panel muestra "no autorizado" en vez de renderizarse para un usuario no admin', async ({ page, context }) => {
    const session = await seedSession('user');
    try {
      await signInAs(context, session);
      await page.goto('/admin');
      await expect(page.getByText('No tenés permisos de administrador')).toBeVisible();
    } finally {
      await cleanup({ userIds: [session.userId] });
    }
  });
});
