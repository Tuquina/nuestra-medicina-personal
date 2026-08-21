// Helpers for driving the fake Mercado Pago server's test-only control
// endpoints (fixtures/mercadopago-fake-server.js) and for sending real,
// correctly-signed webhook requests to the backend — the HMAC math here
// exactly mirrors backend/internal/infrastructure/mercadopago/webhook.go's
// Validate(), so these tests exercise the real signature-validation code,
// not a stub of it. Only the upstream payment provider is fake; see
// e2e/README.md.
import { createHmac } from 'node:crypto';
import type { APIRequestContext, APIResponse } from '@playwright/test';

// Playwright's own `request` fixture always runs against the frontend
// origin (playwright.config.ts's baseURL) since /_control/* isn't proxied
// by Vite — these control calls go straight to the fake server's own
// published port instead, same host/port global-setup.ts polls.
const MP_FAKE_URL = (process.env.E2E_MP_FAKE_URL ?? 'http://localhost:9999').replace(/\/$/, '');

// Matches docker-compose.e2e.yml's MERCADOPAGO_WEBHOOK_SECRET exactly.
const WEBHOOK_SECRET = 'e2e-fake-webhook-secret';

let nextPaymentIdSuffix = 0;

/**
 * Real Mercado Pago payment ids are numeric — the real client (client.go)
 * decodes GetPayment's "id" field as json.Number, which only accepts a bare
 * JSON number literal (see mercadopago-fake-server.js's own handling of
 * this). A descriptive string id would fail that decode, so every fake
 * payment id used against the real webhook needs to look like this.
 */
export function nextFakePaymentId(): string {
  nextPaymentIdSuffix += 1;
  return `${Date.now()}${String(nextPaymentIdSuffix).padStart(4, '0')}`;
}

export type FakePaymentStatus = 'approved' | 'pending' | 'rejected' | 'cancelled' | 'refunded';

export interface FakePayment {
  status?: FakePaymentStatus;
  externalReference: string;
  amountMinorUnits: number;
  currency?: string;
}

/** Registers what GET /v1/payments/{id} on the fake server answers — call before sendWebhook() for the same id. */
export async function registerFakePayment(paymentId: string, payment: FakePayment): Promise<void> {
  const response = await fetch(`${MP_FAKE_URL}/_control/payments/${encodeURIComponent(paymentId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payment),
  });
  if (!response.ok) throw new Error(`registerFakePayment(${paymentId}) failed: ${response.status}`);
}

/** Clears every fake payment the control endpoint knows about — call between tests that reuse payment ids. */
export async function resetFakePayments(): Promise<void> {
  const response = await fetch(`${MP_FAKE_URL}/_control/reset`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`resetFakePayments failed: ${response.status}`);
}

function buildSignatureHeader(dataId: string, requestId: string, timestampSeconds: number, secret: string): string {
  // Same template Mercado Pago itself signs and webhook.go's Validate()
  // reconstructs: "id:<lowercase data.id>;request-id:<X-Request-Id>;ts:<ts>;"
  const template = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestampSeconds};`;
  const v1 = createHmac('sha256', secret).update(template).digest('hex');
  return `ts=${timestampSeconds},v1=${v1}`;
}

export interface WebhookOptions {
  /** Sign with the wrong secret instead — for the "invalid signature is rejected" test. */
  invalidSignature?: boolean;
  /** Override the signed timestamp (seconds since epoch) — for staleness tests. */
  timestampSeconds?: number;
  /** Override the notification type query param (defaults to 'payment'). */
  type?: string;
}

/**
 * POSTs to /api/v1/webhooks/mercadopago exactly as Mercado Pago's own
 * servers would — real query params, real HMAC signature — standing in
 * only for the network hop itself (see e2e/README.md). Requires
 * registerFakePayment(dataId, ...) to have been called first, same as a
 * real webhook only makes sense once GET /v1/payments/{id} can answer it.
 */
export async function sendWebhook(request: APIRequestContext, dataId: string, options: WebhookOptions = {}): Promise<APIResponse> {
  const requestId = `e2e-request-${dataId}`;
  const timestampSeconds = options.timestampSeconds ?? Math.floor(Date.now() / 1000);
  const secret = options.invalidSignature ? 'wrong-secret-on-purpose' : WEBHOOK_SECRET;
  const signature = buildSignatureHeader(dataId, requestId, timestampSeconds, secret);
  const type = options.type ?? 'payment';
  return request.post(`/api/v1/webhooks/mercadopago?type=${encodeURIComponent(type)}&data.id=${encodeURIComponent(dataId)}`, {
    headers: { 'X-Signature': signature, 'X-Request-Id': requestId },
  });
}
