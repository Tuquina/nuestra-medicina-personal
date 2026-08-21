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
 * user's google_subject match one of the (comma-separated) ADMIN_GOOGLE_SUBS entries (e2e-admin-fixture, set in
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
    // last_login_at is nullable in the schema, but every real login path
    // (auth_repository.go's UpsertUser) always sets it — domain/auth.User's
    // LastLoginAt is a plain time.Time, not a pointer, so any authenticated
    // request 500s the moment it scans a NULL here. A direct-SQL fixture is
    // the only way that column can ever end up NULL; set it explicitly so
    // this seeded row matches what a real login always produces.
    await client.query(
      `INSERT INTO users (id, google_subject, email, display_name, last_login_at) VALUES ($1::uuid, $2, $3, $4, now())`,
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
  overrides: Partial<SeededBook> & {
    slug: string;
    publishedContent?: Record<string, unknown>;
    /** Set to make the book downloadable from the library right away (see library.spec.ts) — bypasses the admin upload flow, same rationale as everything else in this file: a known fixture beats driving a precondition through the UI when that flow is already covered elsewhere (the admin ebook upload tests). */
    ebookFilePath?: string;
    format?: string;
  },
): Promise<SeededBook> {
  const book: SeededBook = {
    id: randomUUID(),
    title: overrides.title ?? `E2E book ${overrides.slug}`,
    priceMinorUnits: overrides.priceMinorUnits ?? 1_000_00,
    currency: overrides.currency ?? 'ARS',
    ...overrides,
  };
  const publishedContent = overrides.publishedContent ?? { schemaVersion: 1, sections: [] };
  const ebookFilePath = overrides.ebookFilePath ?? null;
  const format = overrides.format ?? (ebookFilePath ? 'pdf' : '');

  const client = await db().connect();
  try {
    await client.query(
      `INSERT INTO books (id, slug, title, author_name, price_minor_units, currency, status, ebook_file_path, format)
       VALUES ($1::uuid, $2, $3, 'E2E Author', $4, $5, 'PUBLISHED', $6, $7)`,
      [book.id, book.slug, book.title, book.priceMinorUnits, book.currency, ebookFilePath, format],
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

export interface SeededCoupon {
  id: string;
  code: string;
}

/**
 * Seeds a coupon directly (coupons + coupon_books), for the checkout
 * validation scenarios (valid/invalid/expired/wrong-book/currency-mismatch
 * — see purchase.spec.ts) — same rationale as seedBook/seedSession: known,
 * deterministic fixtures beat driving the admin coupon UI for every case.
 * `startsAt`/`endsAt` are 'YYYY-MM-DD' strings (coupon.go's own format).
 */
export async function seedCoupon(overrides: {
  code: string;
  kind: 'PERCENTAGE' | 'FIXED';
  value: number;
  currency?: string;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number | null;
  appliesToAll?: boolean;
  bookIds?: string[];
  active?: boolean;
}): Promise<SeededCoupon> {
  const id = randomUUID();
  const startsAt = overrides.startsAt ?? '2020-01-01';
  const endsAt = overrides.endsAt ?? '2999-12-31';
  const client = await db().connect();
  try {
    await client.query(
      `INSERT INTO coupons (id, code, kind, value, currency, starts_at, ends_at, usage_limit, applies_to_all, active)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::date, $7::date, $8, $9, $10)`,
      [
        id, overrides.code, overrides.kind, overrides.value, overrides.currency ?? 'ARS',
        startsAt, endsAt, overrides.usageLimit ?? null, overrides.appliesToAll ?? true, overrides.active ?? true,
      ],
    );
    for (const bookId of overrides.bookIds ?? []) {
      await client.query(`INSERT INTO coupon_books (coupon_id, book_id) VALUES ($1::uuid, $2::uuid)`, [id, bookId]);
    }
  } finally {
    client.release();
  }
  return { id, code: overrides.code };
}

export interface SeededOrder {
  id: string;
}

/**
 * Seeds a PAID order + a matching APPROVED payment directly — mirrors
 * exactly what ApplyPayment (orders_repository.go) leaves behind after a
 * real webhook. Used by tests whose focus is downstream of a successful
 * purchase (library access, reviews) — the checkout-to-webhook pipeline
 * itself is purchase.spec.ts's job, not every other test's.
 */
export async function seedPaidOrder(overrides: {
  userId: string;
  book: SeededBook;
  discountMinorUnits?: number;
  couponCode?: string;
}): Promise<SeededOrder> {
  const orderId = randomUUID();
  const itemId = randomUUID();
  const paymentId = randomUUID();
  const discount = overrides.discountMinorUnits ?? 0;
  const total = overrides.book.priceMinorUnits - discount;
  const client = await db().connect();
  try {
    await client.query(
      `INSERT INTO orders (id, user_id, status, total_minor_units, currency, coupon_code, discount_minor_units, paid_at)
       VALUES ($1::uuid, $2::uuid, 'PAID', $3, $4, $5, $6, now())`,
      [orderId, overrides.userId, total, overrides.book.currency, overrides.couponCode ?? null, discount],
    );
    await client.query(
      `INSERT INTO order_items (id, order_id, book_id, book_title, unit_price_minor_units, quantity, currency)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, 1, $6)`,
      [itemId, orderId, overrides.book.id, overrides.book.title, overrides.book.priceMinorUnits, overrides.book.currency],
    );
    await client.query(
      `INSERT INTO payments (id, order_id, provider, provider_payment_id, status, amount_minor_units, currency, raw_status)
       VALUES ($1::uuid, $2::uuid, 'MERCADO_PAGO', $3, 'APPROVED', $4, $5, 'approved')`,
      [paymentId, orderId, `e2e-seed-payment-${paymentId}`, total, overrides.book.currency],
    );
  } finally {
    client.release();
  }
  return { id: orderId };
}

/** Reads an order's current status — for webhook.spec.ts assertions on what ApplyPayment actually left behind. */
export async function getOrderStatus(orderId: string): Promise<string | undefined> {
  const client = await db().connect();
  try {
    const result = await client.query(`SELECT status FROM orders WHERE id = $1::uuid`, [orderId]);
    return result.rows[0]?.status;
  } finally {
    client.release();
  }
}

/** Counts payment rows for an order — for webhook.spec.ts's "a retried webhook upserts, it doesn't duplicate" assertion. */
export async function countPayments(orderId: string): Promise<number> {
  const client = await db().connect();
  try {
    const result = await client.query(`SELECT count(*)::int AS count FROM payments WHERE order_id = $1::uuid`, [orderId]);
    return result.rows[0].count;
  } finally {
    client.release();
  }
}

/**
 * Deletes everything a test seeded, by the exact ids it tracked — call in
 * a test's `afterEach`/`afterAll`. Order matters (children before parents)
 * so FKs don't block the delete; each statement is a no-op if that kind of
 * fixture wasn't used.
 */
export async function cleanup(ids: {
  userIds?: string[];
  bookIds?: string[];
  orderIds?: string[];
  couponIds?: string[];
  /** CMS pages not tied to a book (HOME/FAQ/TERMINOS/etc.) — there's no
   * admin endpoint to delete one (pages_handler.go has no Delete), so
   * anything admin-pages.spec.ts creates needs this to clean up. Pages tied
   * to a book (type BOOK) cascade from the book itself instead — pass
   * those via `bookIds`, not here. */
  pageIds?: string[];
}): Promise<void> {
  const client = await db().connect();
  try {
    for (const orderId of ids.orderIds ?? []) {
      await client.query(`DELETE FROM order_items WHERE order_id = $1::uuid`, [orderId]);
      await client.query(`DELETE FROM payments WHERE order_id = $1::uuid`, [orderId]);
      await client.query(`DELETE FROM orders WHERE id = $1::uuid`, [orderId]);
    }
    for (const pageId of ids.pageIds ?? []) {
      // page_versions.page_id is ON DELETE CASCADE (migrations/001).
      await client.query(`DELETE FROM pages WHERE id = $1::uuid`, [pageId]);
    }
    for (const couponId of ids.couponIds ?? []) {
      await client.query(`DELETE FROM coupon_books WHERE coupon_id = $1::uuid`, [couponId]);
      await client.query(`DELETE FROM coupons WHERE id = $1::uuid`, [couponId]);
    }
    for (const bookId of ids.bookIds ?? []) {
      await client.query(`DELETE FROM reviews WHERE book_id = $1::uuid`, [bookId]);
      await client.query(`DELETE FROM order_items WHERE book_id = $1::uuid`, [bookId]);
      await client.query(`DELETE FROM books WHERE id = $1::uuid`, [bookId]);
    }
    for (const userId of ids.userIds ?? []) {
      await client.query(`DELETE FROM reviews WHERE user_id = $1::uuid`, [userId]);
      // page_versions.created_by references users too — an admin who
      // published a CMS page (admin-pages.spec.ts) leaves one of these per
      // publish, which would otherwise block deleting that admin user.
      await client.query(`DELETE FROM page_versions WHERE created_by = $1::uuid`, [userId]);
      await client.query(`DELETE FROM sessions WHERE user_id = $1::uuid`, [userId]);
      await client.query(`DELETE FROM users WHERE id = $1::uuid`, [userId]);
    }
  } finally {
    client.release();
  }
}
