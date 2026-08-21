// Phase 2: reviews — a paid purchase is required to submit one, a new
// review starts PENDING and is invisible on the public book page until an
// admin approves it. Orders are seeded directly as PAID (seedPaidOrder) —
// the purchase pipeline itself is purchase.spec.ts's job.
import { test, expect } from '@playwright/test';
import { seedBook, seedSession, seedPaidOrder, cleanup } from '../fixtures/db';
import { signInAs } from '../fixtures/auth';
import { SAME_ORIGIN_HEADERS } from '../fixtures/http';

test.describe('reseñas', () => {
  test('enviar una reseña sin haber comprado el libro es rechazado', async ({ context }) => {
    const book = await seedBook({ slug: `e2e-review-nopurchase-${Date.now()}` });
    const session = await seedSession('user');
    try {
      await signInAs(context, session);
      const response = await context.request.post(`/api/v1/books/${book.slug}/reviews`, {
        headers: SAME_ORIGIN_HEADERS,
        data: { rating: 5, body: 'Excelente libro.' },
      });
      expect(response.status()).toBe(403);
      expect((await response.json()).error.code).toBe('REVIEW_PURCHASE_REQUIRED');
    } finally {
      await cleanup({ userIds: [session.userId], bookIds: [book.id] });
    }
  });

  test('una reseña de un comprador queda pendiente hasta que un admin la aprueba', async ({ context, browser }) => {
    const book = await seedBook({ slug: `e2e-review-flow-${Date.now()}` });
    const session = await seedSession('user');
    const admin = await seedSession('admin');
    const order = await seedPaidOrder({ userId: session.userId, book });

    // Two identities are needed at once (buyer + admin) — a second, isolated
    // browser context keeps their session cookies from colliding, the same
    // way two different browsers would.
    const adminContext = await browser.newContext();
    try {
      await signInAs(context, session);
      const created = await context.request.post(`/api/v1/books/${book.slug}/reviews`, {
        headers: SAME_ORIGIN_HEADERS,
        data: { rating: 4, body: 'Me ayudó mucho a ordenar mis ideas.' },
      });
      expect(created.status()).toBe(201);
      const review = await created.json();
      expect(review.status).toBe('PENDING');

      const publicBefore = await context.request.get(`/api/v1/books/${book.slug}/reviews`);
      expect((await publicBefore.json()).items).not.toContainEqual(expect.objectContaining({ id: review.id }));

      await signInAs(adminContext, admin);
      const adminList = await adminContext.request.get('/api/v1/admin/reviews');
      expect(adminList.status()).toBe(200);
      expect((await adminList.json()).items).toContainEqual(expect.objectContaining({ id: review.id, status: 'PENDING' }));

      const approved = await adminContext.request.put(`/api/v1/admin/reviews/${review.id}/status`, {
        headers: SAME_ORIGIN_HEADERS,
        data: { status: 'APPROVED' },
      });
      expect(approved.status()).toBe(200);

      const publicAfter = await context.request.get(`/api/v1/books/${book.slug}/reviews`);
      expect((await publicAfter.json()).items).toContainEqual(expect.objectContaining({ id: review.id, status: 'APPROVED' }));
    } finally {
      await adminContext.close();
      await cleanup({ userIds: [session.userId, admin.userId], bookIds: [book.id], orderIds: [order.id] });
    }
  });
});
