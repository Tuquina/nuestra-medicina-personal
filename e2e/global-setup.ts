// Brings up the real dev stack (docker-compose.yml) plus the E2E-only
// overrides (e2e/docker-compose.e2e.yml — fake Mercado Pago server,
// deterministic ADMIN_GOOGLE_SUB, raised rate limits) before any test file
// runs. See README.md for the full rationale.
import { compose } from './fixtures/compose';

// Overridable so the suite can also run from a container joined to the
// compose network (service DNS names instead of published host ports) —
// used to verify this harness itself without host ports free. Local runs
// and CI both just use the defaults.
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8080';
const FRONTEND_URL = process.env.E2E_FRONTEND_URL ?? 'http://localhost:5173';
const MP_FAKE_URL = process.env.E2E_MP_FAKE_URL ?? 'http://localhost:9999';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180_000;

async function waitUntilReady(url: string, label: string, init?: RequestInit): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, init);
      if (response.ok || (response.status >= 200 && response.status < 500)) return;
      lastError = new Error(`${label} responded with ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Timed out waiting for ${label} at ${url}: ${String(lastError)}`);
}

export default async function globalSetup(): Promise<void> {
  if (process.env.E2E_SKIP_COMPOSE === '1') {
    console.log('[e2e] E2E_SKIP_COMPOSE=1 set — assuming the stack is already running.');
  } else {
    console.log('[e2e] starting docker compose stack...');
    compose('up', '-d', '--build');
  }

  console.log('[e2e] waiting for backend health check...');
  await waitUntilReady(`${API_URL}/health/ready`, 'backend API');

  console.log('[e2e] waiting for frontend dev server...');
  await waitUntilReady(`${FRONTEND_URL}/`, 'frontend dev server');

  console.log('[e2e] waiting for fake Mercado Pago server...');
  await waitUntilReady(`${MP_FAKE_URL}/_control/reset`, 'fake Mercado Pago server', { method: 'DELETE' });

  console.log('[e2e] stack is ready.');
}
