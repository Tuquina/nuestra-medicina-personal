// Shared by global-setup.ts and global-teardown.ts so both ever invoke
// `docker compose` the exact same way — in particular with the same
// explicit project name.
//
// Without an explicit name, Compose derives one from the current
// directory (here, the repo root), which is exactly what a developer's
// own `docker compose up` (the regular dev workflow, run from the same
// directory) also gets by default. That would make the E2E stack reuse
// the dev stack's containers *and named volumes* — so global-teardown's
// `down -v` would delete a developer's real Postgres data and uploaded
// files the moment they'd ever run the plain dev workflow from this repo
// first. `-p` gives the E2E stack its own project namespace (containers,
// volumes, network), completely isolated from that.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export const REPO_ROOT = path.resolve(__dirname, '..');
export const COMPOSE_PROJECT_NAME = 'nmp-e2e';
export const COMPOSE_ARGS = [
  'compose',
  '-p',
  COMPOSE_PROJECT_NAME,
  '-f',
  'docker-compose.yml',
  '-f',
  'e2e/docker-compose.e2e.yml',
];

export function compose(...args: string[]): void {
  execFileSync('docker', [...COMPOSE_ARGS, ...args], { cwd: REPO_ROOT, stdio: 'inherit' });
}
