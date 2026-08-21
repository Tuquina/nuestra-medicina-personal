import { execFileSync } from 'node:child_process';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..');
const COMPOSE_ARGS = ['compose', '-f', 'docker-compose.yml', '-f', 'e2e/docker-compose.e2e.yml'];

export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_KEEP_STACK === '1' || process.env.E2E_SKIP_COMPOSE === '1') {
    console.log('[e2e] leaving the stack running (E2E_KEEP_STACK or E2E_SKIP_COMPOSE set).');
    return;
  }
  console.log('[e2e] tearing down docker compose stack...');
  execFileSync('docker', [...COMPOSE_ARGS, 'down', '-v'], { cwd: REPO_ROOT, stdio: 'inherit' });
}
