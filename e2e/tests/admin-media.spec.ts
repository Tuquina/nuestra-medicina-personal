// Phase 3: "Multimedia" — upload an image, see it listed, and the real
// in-use guard (media_repository.go's Delete): a media asset referenced by
// a book's cover can't be deleted until that reference is cleared.
import { test, expect } from '@playwright/test';
import { seedSession, seedBook, cleanup } from '../fixtures/db';
import { signInAs } from '../fixtures/auth';
import { SAME_ORIGIN_HEADERS } from '../fixtures/http';

// A minimal valid 1x1 transparent PNG — just needs to pass the real image
// decoder (media/service.go), not look like anything.
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test.describe('administración de multimedia', () => {
  test('subir -> listar -> bloqueado mientras está en uso -> liberar -> borrar', async ({ context }) => {
    const admin = await seedSession('admin');
    const book = await seedBook({ slug: `e2e-admin-media-${Date.now()}` });
    let mediaId: string | undefined;
    try {
      await signInAs(context, admin);

      const uploaded = await context.request.post('/api/v1/admin/media', {
        headers: SAME_ORIGIN_HEADERS,
        multipart: { file: { name: 'cover.png', mimeType: 'image/png', buffer: ONE_PIXEL_PNG } },
      });
      expect(uploaded.status()).toBe(201);
      const media = await uploaded.json();
      mediaId = media.id;
      expect(media.mimeType).toBe('image/png');

      const list = await context.request.get('/api/v1/admin/media');
      expect((await list.json()).items).toContainEqual(expect.objectContaining({ id: mediaId }));

      const bookPayload = {
        slug: book.slug, title: book.title, authorName: 'E2E Author', category: 'salud',
        variant: 'blue', priceMinorUnits: book.priceMinorUnits, currency: book.currency, status: 'PUBLISHED',
      };
      const attached = await context.request.put(`/api/v1/admin/books/${book.id}`, {
        headers: SAME_ORIGIN_HEADERS,
        data: { ...bookPayload, coverMediaId: mediaId },
      });
      expect(attached.status()).toBe(200);
      expect((await attached.json()).coverMediaId).toBe(mediaId);

      const blockedDelete = await context.request.delete(`/api/v1/admin/media/${mediaId}`, { headers: SAME_ORIGIN_HEADERS });
      expect(blockedDelete.status()).toBe(409);
      expect((await blockedDelete.json()).error.code).toBe('MEDIA_IN_USE');

      const detached = await context.request.put(`/api/v1/admin/books/${book.id}`, {
        headers: SAME_ORIGIN_HEADERS,
        data: { ...bookPayload, coverMediaId: null },
      });
      expect(detached.status()).toBe(200);

      const deleted = await context.request.delete(`/api/v1/admin/media/${mediaId}`, { headers: SAME_ORIGIN_HEADERS });
      expect(deleted.status()).toBe(204);
      mediaId = undefined;
    } finally {
      if (mediaId) await context.request.delete(`/api/v1/admin/media/${mediaId}`, { headers: SAME_ORIGIN_HEADERS }).catch(() => {});
      await cleanup({ userIds: [admin.userId], bookIds: [book.id] });
    }
  });
});
