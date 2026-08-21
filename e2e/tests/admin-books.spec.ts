// Phase 3: the "Libros" section (list + form) — the full lifecycle a real
// admin drives: create a draft, get blocked from publishing before the
// landing page exists (a real business rule — books/service.go's Create/
// Update), publish once the landing is published, see it in the public
// catalog, then archive it back out.
import { test, expect } from '@playwright/test';
import { seedSession, cleanup } from '../fixtures/db';
import { signInAs } from '../fixtures/auth';
import { SAME_ORIGIN_HEADERS } from '../fixtures/http';

test.describe('administración de libros', () => {
  test('crear -> bloqueo de publicación sin landing -> publicar -> archivar', async ({ context }) => {
    const admin = await seedSession('admin');
    const slug = `e2e-admin-book-${Date.now()}`;
    let bookId: string | undefined;
    let pageId: string | undefined;
    try {
      await signInAs(context, admin);

      // bookInput (books_handler.go) rejects unknown fields, so every PUT
      // below resends this same shape rather than the response body
      // (which also carries id/hasCover/timestamps bookInput doesn't
      // accept) — just with `status` changed.
      const bookPayload = {
        slug, title: 'Libro de prueba E2E', authorName: 'Autor E2E', category: 'salud',
        variant: 'blue', priceMinorUnits: 250000, currency: 'ARS', status: 'DRAFT',
      };
      const created = await context.request.post('/api/v1/admin/books', {
        headers: SAME_ORIGIN_HEADERS,
        data: bookPayload,
      });
      expect(created.status()).toBe(201);
      const book = await created.json();
      bookId = book.id;
      expect(book.status).toBe('DRAFT');

      // Publishing before the landing page exists is rejected — a book's
      // page can't be created until the book UUID exists, so this order
      // (book first, landing second) is the only one the real admin UI can
      // ever follow too.
      const blockedPublish = await context.request.put(`/api/v1/admin/books/${bookId}`, {
        headers: SAME_ORIGIN_HEADERS,
        data: { ...bookPayload, status: 'PUBLISHED' },
      });
      expect(blockedPublish.status()).toBe(409);
      expect((await blockedPublish.json()).error.code).toBe('BOOK_LANDING_NOT_PUBLISHED');

      const landingPage = await context.request.post('/api/v1/admin/pages', {
        headers: SAME_ORIGIN_HEADERS,
        data: { type: 'BOOK', bookId, slug: `book-${slug}`, title: book.title, content: { schemaVersion: 1, sections: [] } },
      });
      expect(landingPage.status()).toBe(201);
      pageId = (await landingPage.json()).id;
      const published = await context.request.post(`/api/v1/admin/pages/${pageId}/publish`, { headers: SAME_ORIGIN_HEADERS });
      expect(published.status()).toBe(200);

      const publishBook = await context.request.put(`/api/v1/admin/books/${bookId}`, {
        headers: SAME_ORIGIN_HEADERS,
        data: { ...bookPayload, status: 'PUBLISHED' },
      });
      expect(publishBook.status()).toBe(200);
      expect((await publishBook.json()).status).toBe('PUBLISHED');

      const publicList = await context.request.get('/api/v1/books');
      expect((await publicList.json()).items).toContainEqual(expect.objectContaining({ slug }));

      const archived = await context.request.delete(`/api/v1/admin/books/${bookId}`, { headers: SAME_ORIGIN_HEADERS });
      expect(archived.status()).toBe(204);

      const publicListAfterArchive = await context.request.get('/api/v1/books');
      expect((await publicListAfterArchive.json()).items).not.toContainEqual(expect.objectContaining({ slug }));
    } finally {
      // pages.book_id is ON DELETE CASCADE (see migrations/001), so
      // deleting the book below also removes the landing page + its
      // version history — nothing extra to clean up for pageId.
      await cleanup({ userIds: [admin.userId], bookIds: bookId ? [bookId] : [] });
    }
  });
});
