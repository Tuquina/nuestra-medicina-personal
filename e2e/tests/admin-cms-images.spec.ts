import { test, expect } from '@playwright/test';
import { seedSession, cleanup } from '../fixtures/db';
import { signInAs } from '../fixtures/auth';
import { SAME_ORIGIN_HEADERS } from '../fixtures/http';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('CMS image picker uploads, reuses, publishes and preserves gallery pairs', async ({ page, context }) => {
  const admin = await seedSession('admin');
  await signInAs(context, admin);
  const original = await (await context.request.get('/api/v1/admin/pages/inicio')).json();
  const endpoint = `/api/v1/admin/pages/${original.id}`;
  const filename = `e2e-editorial-${Date.now()}.png`;
  let mediaId: string | undefined;
  try {
    await page.goto('/admin/sobre-el-proyecto');
    await page.getByRole('button', { name: /^(Elegir|Cambiar) imagen$/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Elegir imagen' });
    const upload = page.waitForResponse((r) => r.url().endsWith('/admin/media') && r.request().method() === 'POST');
    await dialog.getByLabel('Subir imagen (JPEG o PNG)').setInputFiles({ name: filename, mimeType: 'image/png', buffer: png });
    const uploaded = await upload;
    expect(uploaded.status()).toBe(201);
    mediaId = (await uploaded.json()).id;
    await expect(dialog).not.toBeVisible();
    await page.getByLabel('Descripción de la imagen', { exact: true }).fill('Retrato editorial de prueba');
    const saved = page.waitForResponse((r) => r.url().endsWith('/draft') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    expect((await saved).status()).toBe(200);
    expect((await (await context.request.get('/api/v1/pages/inicio')).json()).content).toEqual(original.publishedContent);
    await page.reload();
    await expect(page.getByAltText('Imagen seleccionada')).toHaveAttribute('src', `/api/v1/media/${mediaId}`);
    await page.getByRole('button', { name: 'Quitar imagen' }).click();
    await page.getByRole('button', { name: 'Elegir imagen', exact: true }).click();
    await dialog.getByLabel('Buscar imagen').fill('e2e-editorial');
    await dialog.getByRole('button', { name: filename }).click();
    const published = page.waitForResponse((r) => r.url().endsWith('/publish'));
    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    expect((await published).status()).toBe(200);
    await page.goto('/');
    const image = page.getByRole('img', { name: 'Retrato editorial de prueba' });
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty('naturalWidth', 1);
    expect((await context.request.delete(`/api/v1/admin/media/${mediaId}`, { headers: SAME_ORIGIN_HEADERS })).status()).toBe(409);

    await page.goto('/admin/paginas');
    // Canvas content is deliberately read-only; its wrapper selects the block.
    await page.getByRole('region', { name: 'Galería de naturaleza y vida' }).locator('..').locator('..').click();
    const first = page.getByRole('group', { name: 'Foto 1', exact: true });
    await first.getByRole('button', { name: 'Elegir imagen', exact: true }).click();
    await dialog.getByRole('button', { name: filename }).click();
    await page.getByLabel('Descripción de la foto 1', { exact: true }).fill('Bosque editorial');
    await page.getByRole('button', { name: 'Bajar foto 1', exact: true }).click();
    await expect(page.getByLabel('Descripción de la foto 2', { exact: true })).toHaveValue('Bosque editorial');
    const gallerySaved = page.waitForResponse((r) => r.url().endsWith('/draft') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    const gallery = (await (await gallerySaved).json()).draftContent.sections.find((s: {type: string}) => s.type === 'gallery');
    expect(gallery.props.imageIds[1]).toBe(mediaId);
    expect(gallery.props.captions[1]).toBe('Bosque editorial');
  } finally {
    test.setTimeout(test.info().timeout + 15_000);
    await context.request.put(`${endpoint}/draft`, { headers: SAME_ORIGIN_HEADERS, data: { content: original.publishedContent } });
    await context.request.post(`${endpoint}/publish`, { headers: SAME_ORIGIN_HEADERS });
    await context.request.put(`${endpoint}/draft`, { headers: SAME_ORIGIN_HEADERS, data: { content: original.draftContent } });
    await cleanup({ userIds: [admin.userId] });
    if (mediaId) {
      const cleaner = await seedSession('admin');
      await signInAs(context, cleaner);
      await context.request.delete(`/api/v1/admin/media/${mediaId}`, { headers: SAME_ORIGIN_HEADERS });
      await cleanup({ userIds: [cleaner.userId] });
    }
  }
});
