// Phase 2: the Mercado Pago webhook endpoint itself — signature validation,
// the "does this payment actually match a local order" guard, and that a
// retried notification (Mercado Pago retries until it gets a 2xx) upserts
// rather than double-processing. Orders here are created through the real
// checkout API (not seeded directly) so each test starts from a real
// PENDING order + preference, same as purchase.spec.ts's happy path.
import { test, expect } from '@playwright/test';
import { seedBook, seedSession, cleanup, getOrderStatus, countPayments, type SeededBook, type SeededSession } from '../fixtures/db';
import { signInAs } from '../fixtures/auth';
import { registerFakePayment, sendWebhook, nextFakePaymentId } from '../fixtures/mercadopago';
import { SAME_ORIGIN_HEADERS } from '../fixtures/http';

async function createPendingOrder(context: import('@playwright/test').BrowserContext, book: SeededBook) {
  const response = await context.request.post('/api/v1/orders', {
    headers: SAME_ORIGIN_HEADERS,
    data: { bookSlug: book.slug },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

test.describe('webhook de Mercado Pago', () => {
  let book: SeededBook;
  let session: SeededSession;
  let orderIds: string[];

  test.beforeEach(async () => {
    book = await seedBook({ slug: `e2e-webhook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, priceMinorUnits: 90000, currency: 'ARS' });
    session = await seedSession('user');
    orderIds = [];
  });

  test.afterEach(async () => {
    await cleanup({ userIds: [session.userId], bookIds: [book.id], orderIds });
  });

  test('firma inválida es rechazada', async ({ context, request }) => {
    await signInAs(context, session);
    const order = await createPendingOrder(context, book);
    orderIds.push(order.id);

    const paymentId = nextFakePaymentId();
    await registerFakePayment(paymentId, { status: 'approved', externalReference: order.id, amountMinorUnits: order.totalMinorUnits, currency: order.currency });
    const response = await sendWebhook(request, paymentId, { invalidSignature: true });

    expect(response.status()).toBe(401);
    expect(await getOrderStatus(order.id)).toBe('PENDING');
  });

  test('un pago que no coincide con ninguna orden local se ignora en silencio', async ({ request }) => {
    // No order was ever created with this external reference — mirrors a
    // payment for an order Mercado Pago knows about but this environment
    // doesn't (order.ErrNotFound), which the handler intentionally answers
    // with 204 rather than leaking anything about which orders do exist.
    const paymentId = nextFakePaymentId();
    await registerFakePayment(paymentId, { status: 'approved', externalReference: '00000000-0000-4000-8000-000000000000', amountMinorUnits: 1, currency: 'ARS' });
    const response = await sendWebhook(request, paymentId);
    expect(response.status()).toBe(204);
  });

  test('un pago con un monto distinto al de la orden se ignora y no la marca paga', async ({ context, request }) => {
    await signInAs(context, session);
    const order = await createPendingOrder(context, book);
    orderIds.push(order.id);

    const paymentId = nextFakePaymentId();
    await registerFakePayment(paymentId, {
      status: 'approved', externalReference: order.id,
      amountMinorUnits: order.totalMinorUnits + 1, // deliberately wrong
      currency: order.currency,
    });
    const response = await sendWebhook(request, paymentId);

    expect(response.status()).toBe(204); // order.ErrPaymentMismatch, same silent-204 handling as ErrNotFound
    expect(await getOrderStatus(order.id)).toBe('PENDING');
  });

  test('un pago pendiente y luego aprobado transiciona la orden y no duplica el pago', async ({ context, request }) => {
    await signInAs(context, session);
    const order = await createPendingOrder(context, book);
    orderIds.push(order.id);
    const paymentId = nextFakePaymentId();

    await registerFakePayment(paymentId, { status: 'pending', externalReference: order.id, amountMinorUnits: order.totalMinorUnits, currency: order.currency });
    const firstResponse = await sendWebhook(request, paymentId);
    expect(firstResponse.status()).toBe(204);
    expect(await getOrderStatus(order.id)).toBe('PENDING');
    expect(await countPayments(order.id)).toBe(1);

    // Mercado Pago approves the same payment; a real notification service
    // would also retry the *same* notification at least once until it gets
    // a 2xx, so this also doubles as the "retry doesn't duplicate" case —
    // the payments table's UNIQUE (provider, provider_payment_id) means
    // both webhook deliveries upsert the same row.
    await registerFakePayment(paymentId, { status: 'approved', externalReference: order.id, amountMinorUnits: order.totalMinorUnits, currency: order.currency });
    const secondResponse = await sendWebhook(request, paymentId);
    const thirdResponse = await sendWebhook(request, paymentId);
    expect(secondResponse.status()).toBe(204);
    expect(thirdResponse.status()).toBe(204);
    expect(await getOrderStatus(order.id)).toBe('PAID');
    expect(await countPayments(order.id)).toBe(1);
  });
});
