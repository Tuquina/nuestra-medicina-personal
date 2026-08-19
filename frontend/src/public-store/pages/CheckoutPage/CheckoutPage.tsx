import type { CSSProperties } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PublicFooter } from '../../../shared/components/PublicFooter/PublicFooter';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { BrandMark } from '../../../shared/components/BrandMark/BrandMark';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { PUBLISHED_BOOKS as BOOKS } from '../../data/books';
import { formatPrice } from '../../../shared/utils/money';
import { ORDERS_URL } from '../../../shared/config/api';
import { hardNavigate } from '../../../shared/utils/navigation';
import { NotFoundPage } from '../NotFoundPage/NotFoundPage';
import styles from './CheckoutPage.module.css';

type CheckoutStatus = 'pre' | 'approved' | 'pending' | 'failed';

const STATUS_TABS: { value: CheckoutStatus; label: string }[] = [
  { value: 'pre', label: 'Antes de pagar' },
  { value: 'approved', label: 'Aprobado' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'failed', label: 'Rechazado' },
];

const GLOW_COLOR: Record<CheckoutStatus, string> = {
  pre: 'var(--color-accent-amber-soft)',
  approved: 'oklch(80% 0.1 145)',
  pending: 'oklch(82% 0.11 70)',
  failed: 'oklch(80% 0.1 25)',
};

function isCheckoutStatus(value: string | null): value is CheckoutStatus {
  return value === 'pre' || value === 'approved' || value === 'pending' || value === 'failed';
}

/**
 * `/checkout/:slug` — the pre-payment screen plus the three post-payment
 * result states, built from Checkout.dc.html.
 *
 * Mercado Pago's `back_urls` (architecture.md §23) redirect here with a
 * status of some kind; that's modeled as a `?status=` query param rather
 * than four separate routes. The `pre` state's Mercado Pago button really
 * calls `POST /api/v1/orders` — there's no backend yet, so it 404s and
 * nothing changes on screen. It deliberately does **not** fake a success
 * state on click: architecture.md §24 is explicit that a redirect is
 * never proof of payment on its own, only a webhook-confirmed order is,
 * so the approved/pending/failed states below are only ever reachable
 * from a real status (or the preview tabs, for now).
 */
export function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const book = BOOKS.find((entry) => entry.slug === slug);

  useDocumentTitle(
    book ? `Checkout · ${book.title} · Nuestra Medicina Personal` : 'Checkout · Nuestra Medicina Personal',
  );

  if (!book) return <NotFoundPage />;

  const statusParam = searchParams.get('status');
  const status: CheckoutStatus = isCheckoutStatus(statusParam) ? statusParam : 'pre';

  const setStatus = (next: CheckoutStatus) => {
    if (next === 'pre') {
      setSearchParams({});
    } else {
      setSearchParams({ status: next });
    }
  };

  const handleContinue = async () => {
    try {
      const response = await fetch(ORDERS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookSlug: book.slug }),
      });
      const data: { checkoutUrl?: string } = await response.json();
      if (data.checkoutUrl) hardNavigate(data.checkoutUrl);
    } catch {
      // No backend yet — nothing to redirect to. Left as a no-op rather
      // than faking a Mercado Pago handoff.
    }
  };

  return (
    <div className={styles.page}>
      <GradientTopBar />

      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          <BrandMark />
          Nuestra Medicina Personal
        </Link>
        <div className={styles.tabs}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={[styles.tab, status === tab.value ? styles.tabActive : ''].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className={styles.main}>
        <div
          className={styles.glow}
          style={{ '--glow-color': GLOW_COLOR[status] } as CSSProperties}
          aria-hidden="true"
        />

        <div className={styles.card}>
          {status === 'pre' && (
            <>
              <p className={styles.eyebrow}>Estás por comprar</p>
              <h1 className={styles.title}>{book.title}</h1>
              <p className={styles.price}>{formatPrice(book.priceMinorUnits, book.currency)}</p>
              <button type="button" className={styles.primaryAction} onClick={handleContinue}>
                Continuar con Mercado Pago
              </button>
              <p className={styles.fineprint}>
                Serás redirigido a Mercado Pago para completar el pago de forma segura.
              </p>
            </>
          )}

          {status === 'approved' && (
            <>
              <span className={[styles.statusIcon, styles.statusSuccess].join(' ')} aria-hidden="true">
                ✓
              </span>
              <h1 className={[styles.title, styles.titleWithGap].join(' ')}>¡Tu compra fue confirmada!</h1>
              <p className={styles.body}>El libro ya está disponible en tu biblioteca.</p>
              <Link to="/biblioteca" className={styles.primaryAction}>
                Ir a mi biblioteca
              </Link>
            </>
          )}

          {status === 'pending' && (
            <>
              <span className={[styles.statusIcon, styles.statusPending].join(' ')} aria-hidden="true">
                <span className={[styles.clockHand, styles.clockHandHour].join(' ')} />
                <span className={[styles.clockHand, styles.clockHandMinute].join(' ')} />
              </span>
              <h1 className={[styles.title, styles.titleWithGap].join(' ')}>Tu pago está pendiente</h1>
              <p className={styles.body}>Te avisaremos cuando Mercado Pago confirme la operación.</p>
              <Link to="/biblioteca" className={styles.primaryAction}>
                Ver mi biblioteca
              </Link>
            </>
          )}

          {status === 'failed' && (
            <>
              <span className={[styles.statusIcon, styles.statusDanger].join(' ')} aria-hidden="true">
                ✕
              </span>
              <h1 className={[styles.title, styles.titleWithGap].join(' ')}>No pudimos confirmar el pago</h1>
              <p className={styles.body}>Podés intentarlo nuevamente.</p>
              <Link to={`/libros/${book.slug}`} className={styles.primaryAction}>
                Volver al libro
              </Link>
            </>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

