// Fake Mercado Pago server for E2E tests. Implements only the two REST
// calls the real client (backend/internal/infrastructure/mercadopago/client.go)
// makes, in the same request/response shape MP itself uses — the real
// signature validation and payment-verification code in the app runs for
// real against this, only the upstream is fake. See e2e/README.md.
//
// Plain Node `http`, no dependencies, so it can run unmodified inside a
// bare `node:20-alpine` container (see e2e/docker-compose.e2e.yml) or
// directly on the host for local runs.
'use strict';

const http = require('http');

/** @type {Map<string, {status: string, externalReference: string, amountMinorUnits: number, currency: string}>} */
const payments = new Map();
let nextPreferenceID = 1;

// The app's MERCADOPAGO_PUBLIC_BASE_URL is a dummy HTTPS value (see
// docker-compose.e2e.yml) that only exists to satisfy the backend's own
// config validation — it's never actually reachable. The real,
// browser-reachable frontend origin is this env var instead; every
// init_point this server hands back substitutes it in, keeping only the
// path/query (e.g. /checkout/un-libro?status=approved) from what the app sent.
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '');

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

function readJSONBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Minor units (integer) -> the decimal string Mercado Pago's own API uses
// for transaction_amount (e.g. 189050 -> "1890.50"). The real client parses
// this back with big.Rat, so exact string formatting matters more than the
// JS float it round-trips through here.
function minorUnitsToDecimalString(minorUnits) {
  const sign = minorUnits < 0 ? '-' : '';
  const absolute = Math.abs(minorUnits);
  const wholePart = Math.floor(absolute / 100);
  const centsPart = String(absolute % 100).padStart(2, '0');
  return `${sign}${wholePart}.${centsPart}`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  (async () => {
    if (req.method === 'POST' && url.pathname === '/checkout/preferences') {
      const body = await readJSONBody(req);
      const preferenceID = `fake-pref-${nextPreferenceID++}`;
      let pathAndQuery = '/';
      if (body?.back_urls?.success) {
        const successURL = new URL(body.back_urls.success);
        pathAndQuery = successURL.pathname + successURL.search;
      }
      send(res, 201, { id: preferenceID, init_point: PUBLIC_BASE_URL + pathAndQuery });
      return;
    }

    // Test-only control endpoint: registers what GET /v1/payments/{id}
    // below should answer, before the test triggers the webhook.
    if (req.method === 'POST' && url.pathname.startsWith('/_control/payments/')) {
      const paymentID = decodeURIComponent(url.pathname.slice('/_control/payments/'.length));
      const body = await readJSONBody(req);
      payments.set(paymentID, {
        status: body.status ?? 'approved',
        externalReference: body.externalReference,
        amountMinorUnits: body.amountMinorUnits,
        currency: body.currency ?? 'ARS',
      });
      send(res, 204, {});
      return;
    }

    if (req.method === 'DELETE' && url.pathname === '/_control/reset') {
      payments.clear();
      send(res, 204, {});
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/v1/payments/')) {
      const paymentID = decodeURIComponent(url.pathname.slice('/v1/payments/'.length));
      const payment = payments.get(paymentID);
      if (!payment) {
        send(res, 404, { message: `no fake payment registered for ${paymentID} — call POST /_control/payments/${paymentID} first` });
        return;
      }
      send(res, 200, {
        id: paymentID,
        status: payment.status,
        external_reference: payment.externalReference,
        transaction_amount: Number(minorUnitsToDecimalString(payment.amountMinorUnits)),
        currency_id: payment.currency,
      });
      return;
    }

    send(res, 404, { message: `unhandled fake mercado pago request: ${req.method} ${url.pathname}` });
  })().catch((err) => {
    send(res, 500, { message: String(err && err.stack ? err.stack : err) });
  });
});

const port = Number(process.env.PORT || 9999);
server.listen(port, () => {
  // eslint-disable-next-line no-console -- this is a standalone fixture process, not part of the app
  console.log(`fake mercado pago server listening on :${port}`);
});
