// Phase 2: library access control (architecture.md §27) — GET /api/v1/me/books
// and GET /api/v1/books/{id}/download must only ever expose a book to the
// user who actually paid for it. Orders here are seeded directly as PAID
// (fixtures/db.ts's seedPaidOrder) — the checkout-to-webhook pipeline that
// produces a PAID order for real is purchase.spec.ts's job, not this file's.
import { test, expect } from '@playwright/test';
import { seedBook, seedSession, seedPaidOrder, cleanup } from '../fixtures/db';
import { signInAs } from '../fixtures/auth';

test.describe('acceso a la biblioteca', () => {
  test('sin sesión, listar y descargar requieren autenticación', async ({ request }) => {
    const book = await seedBook({ slug: `e2e-library-anon-${Date.now()}` });
    try {
      const list = await request.get('/api/v1/me/books');
      expect(list.status()).toBe(401);

      const download = await request.get(`/api/v1/books/${book.id}/download`);
      expect(download.status()).toBe(401);
    } finally {
      await cleanup({ bookIds: [book.id] });
    }
  });

  test('un usuario sin la compra no puede descargar y no ve el libro en su biblioteca', async ({ context }) => {
    const book = await seedBook({ slug: `e2e-library-nopurchase-${Date.now()}`, ebookFilePath: 'ebooks/e2e-library-nopurchase.pdf' });
    const session = await seedSession('user');
    try {
      await signInAs(context, session);

      const list = await context.request.get('/api/v1/me/books');
      expect(list.status()).toBe(200);
      expect((await list.json()).items).not.toContainEqual(expect.objectContaining({ id: book.id }));

      const download = await context.request.get(`/api/v1/books/${book.id}/download`);
      expect(download.status()).toBe(404);
      expect((await download.json()).error.code).toBe('EBOOK_NOT_AVAILABLE');
    } finally {
      await cleanup({ userIds: [session.userId], bookIds: [book.id] });
    }
  });

  test('el dueño de la compra ve el libro en su biblioteca y puede descargarlo', async ({ context }) => {
    const book = await seedBook({ slug: `e2e-library-owner-${Date.now()}`, ebookFilePath: 'ebooks/e2e-library-owner.pdf' });
    const session = await seedSession('user');
    const order = await seedPaidOrder({ userId: session.userId, book });
    try {
      await signInAs(context, session);

      const list = await context.request.get('/api/v1/me/books');
      expect(list.status()).toBe(200);
      const items = (await list.json()).items;
      expect(items).toContainEqual(expect.objectContaining({ id: book.id, downloadAvailable: true }));

      const download = await context.request.get(`/api/v1/books/${book.id}/download`);
      expect(download.status()).toBe(200);
      expect(download.headers()['content-type']).toBe('application/pdf');
      expect(download.headers()['content-disposition']).toContain('attachment');
      // The Go handler hands the actual bytes off to nginx via
      // X-Accel-Redirect (see library_handler.go) — there's no nginx in
      // front of this dev stack, so the header itself (pointing at the
      // right storage key) is what proves authorization succeeded, not the
      // response body.
      expect(download.headers()['x-accel-redirect']).toContain('e2e-library-owner.pdf');
    } finally {
      await cleanup({ userIds: [session.userId], bookIds: [book.id], orderIds: [order.id] });
    }
  });
});
