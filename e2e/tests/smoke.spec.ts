// First real test against the stack — exists to prove the E2E
// infrastructure itself works (docker-compose stack, fake Mercado Pago
// server, DB fixture seeding) before Phase 2 builds the real purchase/
// webhook/library suites on top of it.
import { test, expect } from '@playwright/test';
import { seedBook, cleanup } from '../fixtures/db';

test.describe('E2E infrastructure smoke test', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Nuestra Medicina Personal');
  });

  test('a seeded published book appears in the public catalog', async ({ page }) => {
    const book = await seedBook({ slug: `e2e-smoke-${Date.now()}`, title: 'E2E Smoke Test Book' });
    try {
      await page.goto('/libros');
      await expect(page.getByRole('heading', { name: book.title })).toBeVisible();
    } finally {
      await cleanup({ bookIds: [book.id] });
    }
  });

  test('GET /api/v1/auth/google starts the real Google OAuth redirect', async ({ request }) => {
    // Deliberately does not follow the redirect or complete a real Google
    // login (see README.md) — just proves Start() is wired and produces a
    // well-formed authorization URL with the expected security parameters.
    const response = await request.get('/api/v1/auth/google', { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    const location = response.headers()['location'] ?? '';
    expect(location).toContain('accounts.google.com');
    expect(location).toContain('state=');
    expect(location).toContain('code_challenge=');
  });
});
