// Phase 3: "Cupones" — the admin CRUD side (create/list/update/delete).
// purchase.spec.ts (Phase 2) already covers the checkout-side validation
// rules a coupon is subject to; this covers the management screen itself.
import { test, expect } from '@playwright/test';
import { seedSession, cleanup } from '../fixtures/db';
import { signInAs } from '../fixtures/auth';
import { SAME_ORIGIN_HEADERS } from '../fixtures/http';

test.describe('administración de cupones', () => {
  test('crear -> listar -> actualizar -> borrar', async ({ context }) => {
    const admin = await seedSession('admin');
    const code = `E2EADMIN${Date.now()}`;
    let couponId: string | undefined;
    try {
      await signInAs(context, admin);

      const created = await context.request.post('/api/v1/admin/coupons', {
        headers: SAME_ORIGIN_HEADERS,
        data: {
          code, kind: 'PERCENTAGE', value: 15, currency: 'ARS',
          startsAt: '2020-01-01', endsAt: '2999-12-31', appliesToAll: true, active: true,
        },
      });
      expect(created.status()).toBe(201);
      const coupon = await created.json();
      couponId = coupon.id;
      expect(coupon.status).toBe('ACTIVE');

      const list = await context.request.get('/api/v1/admin/coupons');
      expect((await list.json()).items).toContainEqual(expect.objectContaining({ id: couponId, code }));

      const updated = await context.request.put(`/api/v1/admin/coupons/${couponId}`, {
        headers: SAME_ORIGIN_HEADERS,
        data: {
          code, kind: 'PERCENTAGE', value: 15, currency: 'ARS',
          startsAt: '2020-01-01', endsAt: '2999-12-31', appliesToAll: true, active: false,
        },
      });
      expect(updated.status()).toBe(200);
      expect((await updated.json()).status).toBe('INACTIVE');

      const deleted = await context.request.delete(`/api/v1/admin/coupons/${couponId}`, { headers: SAME_ORIGIN_HEADERS });
      expect(deleted.status()).toBe(204);
      couponId = undefined;

      const listAfterDelete = await context.request.get('/api/v1/admin/coupons');
      expect((await listAfterDelete.json()).items).not.toContainEqual(expect.objectContaining({ code }));
    } finally {
      await cleanup({ userIds: [admin.userId], couponIds: couponId ? [couponId] : [] });
    }
  });
});
