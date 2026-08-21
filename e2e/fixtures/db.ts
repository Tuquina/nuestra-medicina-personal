// Seeds/cleans fixtures directly in Postgres — same rationale as the Go
// integration tests (backend/internal/infrastructure/postgres/*_integration_test.go):
// E2E tests need known, deterministic rows to exercise against, and the
// app itself has no "create a session" API (sessions only come from a real
// Google login, which E2E deliberately doesn't automate — see README.md).
import { randomUUID, createHash } from 'node:crypto';
import { Pool } from 'pg';

const DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgres://nmp:nmp_dev_only@localhost:5432/nmp';

let pool: Pool | null = null;

function db(): Pool {
  if (!pool) pool = new Pool({ connectionString: DATABASE_URL });
  return pool;
}

export async function closeDB(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** Mirrors authentication.hashToken (backend/internal/application/authentication/service.go) exactly. */
export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export interface SeededSession {
  userId: string;
  rawToken: string;
}

/**
 * Seeds a user + a valid session, returning the raw token to hand to
 * withSessionCookie() (fixtures/auth.ts). Pass role: 'admin' to make the
 * user's google_subject match ADMIN_GOOGLE_SUB (e2e-admin-fixture, set in
 * docker-compose.e2e.yml) — requireAdmin checks that at query time, there's
 * no separate "is admin" column to set.
 */
export async function seedSession(
  role: 'user' | 'admin',
  overrides: { email?: string; displayName?: string } = {},
): Promise<SeededSession> {
  const userId = randomUUID();
  const rawToken = randomUUID() + randomUUID();
  const googleSubject = role === 'admin' ? 'e2e-admin-fixture' : `e2e-user-${userId}`;
  const email = overrides.email ?? `${role}-${userId}@e2e.example`;
  const displayName = overrides.displayName ?? (role === 'admin' ? 'E2E Admin' : 'E2E User');

  const client = await db().connect();
  try {
    await client.query(
      `INSERT INTO users (id, google_subject, email, display_name) VALUES ($1::uuid, $2, $3, $4)`,
      [userId, googleSubject, email, displayName],
    );
    await client.query(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at)
       VALUES (gen_random_uuid(), $1::uuid, $2, now() + interval '2 hours')`,
      [userId, hashSessionToken(rawToken)],
    );
  } finally {
    client.release();
  }
  return { userId, rawToken };
}

export interface SeededBook {
  id: string;
  slug: string;
  title: string;
  priceMinorUnits: number;
  currency: string;
}

/**
 * Seeds a PUBLISHED book — enough for catalog/checkout/library flows.
 *
 * A book is only public (`ListPublished`/`GetPublishedBySlug` —
 * backend/internal/infrastructure/postgres/books_repository.go) when it
 * *also* has a `pages` row of type BOOK, status PUBLISHED, with non-null
 * published_content — mirroring "a book can't be published until its
 * landing page is published". This seeds an empty-but-valid landing page
 * alongside the book so it actually appears publicly; Phase 2's checkout/
 * book-landing tests will likely want a fuller `published_content` (real
 * tagline/synopsis/etc. — see frontend/src/shared/cms/bookLandingContent.ts's
 * readBookLandingProps) and can pass one via `publishedContent`.
 */
export async function seedBook(
  overrides: Partial<SeededBook> & { slug: string; publishedContent?: Record<string, unknown> },
): Promise<SeededBook> {
  const book: SeededBook = {
    id: randomUUID(),
    title: overrides.title ?? `E2E book ${overrides.slug}`,
    priceMinorUnits: overrides.priceMinorUnits ?? 1_000_00,
    currency: overrides.currency ?? 'ARS',
    ...overrides,
  };
  const publishedContent = overrides.publishedContent ?? { schemaVersion: 1, sections: [] };

  const client = await db().connect();
  try {
    await client.query(
      `INSERT INTO books (id, slug, title, author_name, price_minor_units, currency, status)
       VALUES ($1::uuid, $2, $3, 'E2E Author', $4, $5, 'PUBLISHED')`,
      [book.id, book.slug, book.title, book.priceMinorUnits, book.currency],
    );
    await client.query(
      `INSERT INTO pages (id, type, book_id, slug, title, status, draft_content, published_content, published_at)
       VALUES (gen_random_uuid(), 'BOOK', $1::uuid, $2, $3, 'PUBLISHED', $4::jsonb, $4::jsonb, now())`,
      [book.id, `book-${book.slug}`, book.title, JSON.stringify(publishedContent)],
    );
  } finally {
    client.release();
  }
  return book;
}

/**
 * Deletes everything a test seeded, by the exact ids it tracked — call in
 * a test's `afterEach`/`afterAll`. Order matters (children before parents)
 * so FKs don't block the delete; each statement is a no-op if that kind of
 * fixture wasn't used.
 */
export async function cleanup(ids: { userIds?: string[]; bookIds?: string[]; orderIds?: string[] }): Promise<void> {
  const client = await db().connect();
  try {
    for (const orderId of ids.orderIds ?? []) {
      await client.query(`DELETE FROM order_items WHERE order_id = $1::uuid`, [orderId]);
      await client.query(`DELETE FROM payments WHERE order_id = $1::uuid`, [orderId]);
      await client.query(`DELETE FROM orders WHERE id = $1::uuid`, [orderId]);
    }
    for (const bookId of ids.bookIds ?? []) {
      await client.query(`DELETE FROM reviews WHERE book_id = $1::uuid`, [bookId]);
      await client.query(`DELETE FROM books WHERE id = $1::uuid`, [bookId]);
    }
    for (const userId of ids.userIds ?? []) {
      await client.query(`DELETE FROM sessions WHERE user_id = $1::uuid`, [userId]);
      await client.query(`DELETE FROM users WHERE id = $1::uuid`, [userId]);
    }
  } finally {
    client.release();
  }
}
