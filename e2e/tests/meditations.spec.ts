// Meditation pages: the seeded "Respirar y empezar" (migration 016) is public,
// and an admin can create, illustrate, link a YouTube video and publish a new
// one that anyone can then see.
import { test, expect } from '@playwright/test';
import { cleanup, pageIdBySlug, seedSession } from '../fixtures/db';
import { signInAs } from '../fixtures/auth';
import { SAME_ORIGIN_HEADERS } from '../fixtures/http';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test.describe('meditaciones', () => {
  test('the first meditation is published with its video', async ({ page }) => {
    await page.goto('/meditaciones');
    const card = page.getByRole('link', { name: /Respirar y empezar/ });
    await expect(card).toBeVisible();
    // Its old "Próximamente" placeholder card is gone.
    await expect(page.getByRole('heading', { name: 'Respirar y empezar' })).toHaveCount(1);

    await card.click();
    await expect(page).toHaveURL(/\/meditaciones\/respirar-y-empezar$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Respirar y empezar' })).toBeVisible();
    const player = page.locator('iframe[title="Meditación guiada: Respirar y empezar"]');
    await expect(player).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/IJTmQzcsz7o?rel=0');
    await expect(page.getByRole('heading', { name: 'Antes de empezar' })).toBeVisible();
  });

  test('an unknown meditation shows "contenido no disponible"', async ({ page }) => {
    await page.goto('/meditaciones/no-existe-esta-meditacion');
    await expect(page.getByRole('heading', { name: 'Contenido no disponible' })).toBeVisible();
  });

  test('an admin creates, illustrates and publishes a meditation that anyone can see', async ({ browser }) => {
    const admin = await seedSession('admin');
    const slug = `e2e-volver-al-cuerpo-${Date.now()}`;
    const adminContext = await browser.newContext();
    let mediaId: string | undefined;
    try {
      await signInAs(adminContext, admin);
      const page = await adminContext.newPage();

      await page.goto('/admin/meditaciones');
      await expect(page.getByRole('cell', { name: 'Respirar y empezar' })).toBeVisible();

      await page.getByRole('link', { name: 'Nueva meditación' }).first().click();
      await page.getByLabel('Título').fill('Volver al cuerpo E2E');
      await page.getByLabel('Dirección').fill(slug);
      await page.getByRole('button', { name: 'Crear y editar' }).click();
      await expect(page).toHaveURL(new RegExp(`/admin/meditaciones/${slug}$`));

      await page.getByLabel('Descripción', { exact: true }).fill('Un ejercicio simple de atención para momentos de tensión.');
      const upload = page.waitForResponse((response) => response.url().endsWith('/api/v1/admin/media') && response.request().method() === 'POST');
      await page.locator('input[type="file"]').setInputFiles({ name: 'manos.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG });
      mediaId = (await (await upload).json()).id;
      await page.getByLabel('Descripción de la imagen (para lectores de pantalla)').fill('Manos sobre el pecho');
      await page.getByLabel('Duración aproximada (minutos, opcional)').fill('7');
      await page.getByLabel('Link de YouTube').fill('https://youtu.be/IJTmQzcsz7o');
      await expect(page.locator('iframe[title="Vista previa del video"]')).toBeVisible();
      await page.getByLabel('Guía').fill('Apoyá las manos sobre el pecho.\n\nRespirá despacio.');
      await page.getByRole('button', { name: 'Publicar' }).click();
      await expect(page.getByText('Página publicada.')).toBeVisible();

      // Anyone (no session) can now see it, in the list and on its own page.
      const visitor = await browser.newPage();
      await visitor.goto('/meditaciones');
      const card = visitor.getByRole('link', { name: /Volver al cuerpo E2E/ });
      await expect(card).toBeVisible();
      await expect(card.getByRole('img', { name: 'Manos sobre el pecho' })).toBeVisible();
      await card.click();
      await expect(visitor.getByText('Duración aproximada: 7 min')).toBeVisible();
      await expect(visitor.locator('iframe[title="Meditación guiada: Volver al cuerpo E2E"]')).toHaveAttribute(
        'src',
        'https://www.youtube-nocookie.com/embed/IJTmQzcsz7o?rel=0',
      );
      await expect(visitor.getByText('Respirá despacio.')).toBeVisible();
      await visitor.close();
    } finally {
      // Page first (so the image is no longer in use), then the image while
      // the admin session still exists, then the admin user.
      const pageId = await pageIdBySlug(slug);
      if (pageId) await cleanup({ pageIds: [pageId] });
      if (mediaId) {
        await adminContext.request
          .delete(`/api/v1/admin/media/${mediaId}`, { headers: SAME_ORIGIN_HEADERS })
          .catch(() => undefined);
      }
      await adminContext.close();
      await cleanup({ userIds: [admin.userId] });
    }
  });
});
