// Phase 3: Dashboard, Ventas, Clientes and Analítica (which just calls the
// same /admin/dashboard endpoint with a `range` — see AnaliticaPage.tsx) —
// smoke checks proving these read screens actually reflect a real paid
// order, not just that they respond. Uses Phase 2's seedPaidOrder fixture
// rather than re-running the checkout pipeline (purchase.spec.ts's job).
import { test, expect } from '@playwright/test';
import { seedSession, seedBook, seedPaidOrder, cleanup } from '../fixtures/db';
import { signInAs } from '../fixtures/auth';

test.describe('dashboard, ventas y clientes', () => {
  test('reflejan una compra paga real', async ({ page, context }) => {
    const admin = await seedSession('admin');
    const buyer = await seedSession('user', { displayName: 'E2E Comprador Dashboard' });
    const book = await seedBook({ slug: `e2e-admin-dash-${Date.now()}`, priceMinorUnits: 300000, currency: 'ARS' });
    const order = await seedPaidOrder({ userId: buyer.userId, book });
    try {
      await signInAs(context, admin);

      const dashboard = await (await context.request.get('/api/v1/admin/dashboard?range=all')).json();
      expect(dashboard.kpis.approvedSalesCount).toBeGreaterThanOrEqual(1);
      expect(dashboard.recentSales).toContainEqual(expect.objectContaining({ id: order.id, bookId: book.id, customerId: buyer.userId }));

      // Analítica (AnaliticaPage.tsx) hits this exact endpoint with a
      // `range` param instead of its own — proving that plumbing works too.
      const analytics = await (await context.request.get('/api/v1/admin/dashboard?range=7d')).json();
      expect(analytics.range).toBe('7d');

      const sales = await (await context.request.get(`/api/v1/admin/sales?bookSlug=${book.slug}`)).json();
      expect(sales.items).toContainEqual(expect.objectContaining({ id: order.id, orderStatus: 'PAID' }));

      // No filter returns everyone; find our seeded buyer by id.
      const customers = await (await context.request.get('/api/v1/admin/customers')).json();
      expect(customers.items).toContainEqual(
        expect.objectContaining({ id: buyer.userId, paidOrdersCount: 1, booksPurchasedCount: 1 }),
      );

      // Light UI smoke check — proves the real admin session + routing +
      // fetch wiring works end to end; the numeric assertions above (not
      // locale-formatted currency strings) are what actually verify the data.
      await page.goto('/admin');
      await expect(page.getByRole('status')).toBeHidden();
      await expect(page.getByRole('alert')).toBeHidden();
      await expect(page.getByText(/^Ventas \(/)).toBeVisible();
    } finally {
      await cleanup({ userIds: [admin.userId, buyer.userId], bookIds: [book.id], orderIds: [order.id] });
    }
  });
});
