// Phase 3: "Configuración" — site settings get/update, plus the read-only
// integration status flags (settings_handler.go's IntegrationStatus) that
// come from this same environment's real config, not from the settings
// table itself.
import { test, expect } from '@playwright/test';
import { seedSession, cleanup } from '../fixtures/db';
import { signInAs } from '../fixtures/auth';
import { SAME_ORIGIN_HEADERS } from '../fixtures/http';

test.describe('administración de configuración del sitio', () => {
  test('leer y actualizar la configuración del sitio', async ({ context }) => {
    const admin = await seedSession('admin');
    try {
      await signInAs(context, admin);

      const before = await context.request.get('/api/v1/admin/settings');
      expect(before.status()).toBe(200);
      const current = await before.json();
      // Set by docker-compose.e2e.yml (fake, non-empty credentials) — see
      // e2e/README.md's "what's real and what's faked".
      expect(current.integrations.google.configured).toBe(true);
      expect(current.integrations.mercadoPago.configured).toBe(true);

      // settingsInput (settings_handler.go) rejects unknown fields, so this
      // resends only what it accepts — not the full response, which also
      // carries `integrations`/`updatedAt`.
      const newSiteName = `E2E Nuestra Medicina ${Date.now()}`;
      const updated = await context.request.put('/api/v1/admin/settings', {
        headers: SAME_ORIGIN_HEADERS,
        data: {
          siteName: newSiteName, siteDescription: current.siteDescription,
          supportEmail: current.supportEmail, newsletterEmail: current.newsletterEmail,
          senderName: current.senderName, seoTitle: current.seoTitle,
          seoDescription: current.seoDescription, seoIndexable: current.seoIndexable,
        },
      });
      expect(updated.status()).toBe(200);
      expect((await updated.json()).siteName).toBe(newSiteName);

      const after = await context.request.get('/api/v1/admin/settings');
      expect((await after.json()).siteName).toBe(newSiteName);
    } finally {
      await cleanup({ userIds: [admin.userId] });
    }
  });
});
