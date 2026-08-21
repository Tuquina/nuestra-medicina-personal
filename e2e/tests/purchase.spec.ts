// Phase 2: the full checkout pipeline — real UI, real order creation, a
// real (fake-upstream) Mercado Pago webhook, and the coupon validation
// rules the checkout applies before ever creating an order or preference
// (see PR #9, which fixed several of these). See e2e/README.md for what's
// real vs. faked.
import { test, expect } from '@playwright/test';
import { seedBook, seedSession, seedCoupon, cleanup, type SeededBook, type SeededSession } from '../fixtures/db';
import { signInAs } from '../fixtures/auth';
import { registerFakePayment, sendWebhook, nextFakePaymentId } from '../fixtures/mercadopago';
import { SAME_ORIGIN_HEADERS } from '../fixtures/http';

test.describe('compra feliz', () => {
  test('checkout -> webhook aprobado -> biblioteca', async ({ page, context, request }) => {
    const book = await seedBook({ slug: `e2e-purchase-${Date.now()}`, priceMinorUnits: 150000, currency: 'ARS' });
    const session = await seedSession('user');
    let orderId: string | undefined;
    try {
      await signInAs(context, session);
      await page.goto(`/checkout/${book.slug}`);

      const [orderResponse] = await Promise.all([
        page.waitForResponse(
          (response) => response.url().includes('/api/v1/orders') && response.request().method() === 'POST',
        ),
        page.getByRole('button', { name: 'Continuar con Mercado Pago' }).click(),
      ]);
      // handleContinue's hardNavigate fires the instant the order-creation
      // fetch resolves, which can leave this page before Playwright gets a
      // chance to buffer the response body — read the id from the Location
      // header instead (always available) and fetch the rest afterwards
      // through context.request, which isn't tied to this page's lifecycle.
      const location = orderResponse.headers()['location'];
      expect(location).toBeTruthy();
      orderId = location!.split('/').filter(Boolean).pop();
      const order = await (await context.request.get(`/api/v1/orders/${orderId}`)).json();
      expect(order.status).toBe('PENDING');

      // That hardNavigate leaves this page for mp-fake's init_point — which,
      // per mp-fake's own back_urls substitution (see
      // mercadopago-fake-server.js), lands right back on this same origin at
      // /checkout/{slug}?status=approved, before the payment is actually
      // confirmed. That round-trip is a real, full browser navigation.
      await page.waitForURL(new RegExp(`/checkout/${book.slug}\\?status=approved`));
      await expect(page.getByRole('heading', { name: 'Tu pago está pendiente' })).toBeVisible();

      // Simulate Mercado Pago's own async webhook call. The real HMAC
      // signature validation and the real "verify independently with the
      // provider" call (architecture.md §24) run here — only the upstream
      // (mp-fake) is fake.
      const paymentId = nextFakePaymentId();
      await registerFakePayment(paymentId, {
        status: 'approved',
        externalReference: order.id,
        amountMinorUnits: order.totalMinorUnits,
        currency: order.currency,
      });
      const webhookResponse = await sendWebhook(request, paymentId);
      expect(webhookResponse.status()).toBe(204);

      await page.getByRole('button', { name: 'Volver a verificar' }).click();
      await expect(page.getByRole('heading', { name: '¡Tu compra fue confirmada!' })).toBeVisible();

      await page.getByRole('link', { name: 'Ir a mi biblioteca' }).click();
      await expect(page).toHaveURL(/\/biblioteca$/);
      await expect(page.getByRole('heading', { name: book.title })).toBeVisible();
    } finally {
      await cleanup({ userIds: [session.userId], bookIds: [book.id], orderIds: orderId ? [orderId] : [] });
    }
  });
});

test.describe('cupones en checkout', () => {
  let book: SeededBook;
  let session: SeededSession;
  let orderIds: string[];
  let couponIds: string[];

  test.beforeEach(async () => {
    book = await seedBook({ slug: `e2e-coupon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, priceMinorUnits: 200000, currency: 'ARS' });
    session = await seedSession('user');
    orderIds = [];
    couponIds = [];
  });

  test.afterEach(async () => {
    await cleanup({ userIds: [session.userId], bookIds: [book.id], orderIds, couponIds });
  });

  test('cupón porcentual válido aplica el descuento', async ({ context }) => {
    const coupon = await seedCoupon({ code: `PROMO${Date.now()}`, kind: 'PERCENTAGE', value: 20, appliesToAll: true });
    couponIds.push(coupon.id);
    await signInAs(context, session);

    const response = await context.request.post('/api/v1/orders', {
      headers: SAME_ORIGIN_HEADERS,
      data: { bookSlug: book.slug, couponCode: coupon.code },
    });
    expect(response.status()).toBe(201);
    const order = await response.json();
    orderIds.push(order.id);
    expect(order.couponCode).toBe(coupon.code);
    expect(order.discountMinorUnits).toBe(Math.floor((book.priceMinorUnits * 20) / 100));
    expect(order.totalMinorUnits).toBe(book.priceMinorUnits - order.discountMinorUnits);
  });

  test('cupón inexistente es rechazado', async ({ context }) => {
    await signInAs(context, session);
    const response = await context.request.post('/api/v1/orders', {
      headers: SAME_ORIGIN_HEADERS,
      data: { bookSlug: book.slug, couponCode: 'NO-EXISTE' },
    });
    expect(response.status()).toBe(422);
    expect((await response.json()).error.code).toBe('COUPON_INVALID');
  });

  test('cupón vencido es rechazado', async ({ context }) => {
    const coupon = await seedCoupon({
      code: `EXPIRED${Date.now()}`, kind: 'PERCENTAGE', value: 10,
      startsAt: '2020-01-01', endsAt: '2020-01-31',
    });
    couponIds.push(coupon.id);
    await signInAs(context, session);
    const response = await context.request.post('/api/v1/orders', {
      headers: SAME_ORIGIN_HEADERS,
      data: { bookSlug: book.slug, couponCode: coupon.code },
    });
    expect(response.status()).toBe(422);
    expect((await response.json()).error.code).toBe('COUPON_INVALID');
  });

  test('cupón restringido a otro libro es rechazado', async ({ context }) => {
    const otherBook = await seedBook({ slug: `e2e-coupon-other-${Date.now()}` });
    const coupon = await seedCoupon({
      code: `OTHERBOOK${Date.now()}`, kind: 'FIXED', value: 5000, currency: 'ARS',
      appliesToAll: false, bookIds: [otherBook.id],
    });
    couponIds.push(coupon.id);
    try {
      await signInAs(context, session);
      const response = await context.request.post('/api/v1/orders', {
        headers: SAME_ORIGIN_HEADERS,
        data: { bookSlug: book.slug, couponCode: coupon.code },
      });
      expect(response.status()).toBe(422);
      expect((await response.json()).error.code).toBe('COUPON_INVALID');
    } finally {
      await cleanup({ bookIds: [otherBook.id] });
    }
  });

  test('cupón fijo en una moneda distinta a la del libro es rechazado', async ({ context }) => {
    const coupon = await seedCoupon({
      code: `USD${Date.now()}`, kind: 'FIXED', value: 1000, currency: 'USD', appliesToAll: true,
    });
    couponIds.push(coupon.id);
    await signInAs(context, session); // book.currency is 'ARS'
    const response = await context.request.post('/api/v1/orders', {
      headers: SAME_ORIGIN_HEADERS,
      data: { bookSlug: book.slug, couponCode: coupon.code },
    });
    expect(response.status()).toBe(422);
    expect((await response.json()).error.code).toBe('COUPON_INVALID');
  });
});
