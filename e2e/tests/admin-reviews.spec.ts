// Phase 3: "Reseñas" — the one piece of admin review moderation Phase 2's
// reviews.spec.ts didn't cover: an admin deleting a review outright (list +
// approve are already exercised there, as part of the full purchase ->
// review -> moderation flow).
import { test, expect } from '@playwright/test';
import { seedSession, seedBook, seedPaidOrder, cleanup } from '../fixtures/db';
import { signInAs } from '../fixtures/auth';
import { SAME_ORIGIN_HEADERS } from '../fixtures/http';

test.describe('administración de reseñas', () => {
  test('un admin puede borrar una reseña', async ({ context }) => {
    const admin = await seedSession('admin');
    const buyer = await seedSession('user');
    const book = await seedBook({ slug: `e2e-admin-review-${Date.now()}` });
    const order = await seedPaidOrder({ userId: buyer.userId, book });
    try {
      await signInAs(context, buyer);
      const created = await context.request.post(`/api/v1/books/${book.slug}/reviews`, {
        headers: SAME_ORIGIN_HEADERS,
        data: { rating: 3, body: 'Reseña para borrar en Fase 3.' },
      });
      expect(created.status()).toBe(201);
      const review = await created.json();

      await signInAs(context, admin);
      const deleted = await context.request.delete(`/api/v1/admin/reviews/${review.id}`, { headers: SAME_ORIGIN_HEADERS });
      expect(deleted.status()).toBe(204);

      const adminList = await context.request.get('/api/v1/admin/reviews');
      expect((await adminList.json()).items).not.toContainEqual(expect.objectContaining({ id: review.id }));
    } finally {
      await cleanup({ userIds: [admin.userId, buyer.userId], bookIds: [book.id], orderIds: [order.id] });
    }
  });
});
