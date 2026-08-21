import { compose } from './fixtures/compose';

export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_KEEP_STACK === '1' || process.env.E2E_SKIP_COMPOSE === '1') {
    console.log('[e2e] leaving the stack running (E2E_KEEP_STACK or E2E_SKIP_COMPOSE set).');
    return;
  }
  console.log('[e2e] tearing down docker compose stack...');
  compose('down', '-v');
}
