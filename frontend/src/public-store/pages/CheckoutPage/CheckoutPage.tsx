import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PublicFooter } from '../../../shared/components/PublicFooter/PublicFooter';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { BrandMark } from '../../../shared/components/BrandMark/BrandMark';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useCatalog } from '../../catalog/useCatalog';
import { formatPrice } from '../../../shared/utils/money';
import { ORDERS_URL, orderUrl } from '../../../shared/config/api';
import { apiRequest, ApiError } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/useAuth';
import { hardNavigate } from '../../../shared/utils/navigation';
import { readCheckoutOrderId, storeCheckoutOrderId } from '../../checkout/orderStorage';
import type { OrderResponse } from '../../checkout/types';
import { NotFoundPage } from '../NotFoundPage/NotFoundPage';
import styles from './CheckoutPage.module.css';

type CheckoutStatus = 'pre' | 'checking' | 'approved' | 'pending' | 'failed' | 'error';
type VerificationState =
  | { status: 'checking' }
  | { status: 'ready'; order: OrderResponse }
  | { status: 'error' };

const GLOW_COLOR: Record<CheckoutStatus, string> = {
  pre: 'var(--color-accent-amber-soft)',
  checking: 'oklch(82% 0.11 70)',
  approved: 'oklch(80% 0.1 145)',
  pending: 'oklch(82% 0.11 70)',
  failed: 'oklch(80% 0.1 25)',
  error: 'oklch(80% 0.1 25)',
};

/**
 * `/checkout/:slug` — the pre-payment screen plus the three post-payment
 * result states, built from Checkout.dc.html.
 *
 * Mercado Pago redirects back with presentation hints, but this screen never
 * trusts them as proof of payment. The order UUID is kept in sessionStorage
 * before leaving the site and GET /api/v1/orders/{id} selects the final view.
 */
export function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const catalog = useCatalog();
  const auth = useAuth();
  const book = catalog.status === 'ready' ? catalog.books.find((entry) => entry.slug === slug) : undefined;
  const returningFromPayment = searchParams.has('status');
  const storedOrderId = slug ? readCheckoutOrderId(slug) : null;
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [verification, setVerification] = useState<VerificationState>({ status: 'checking' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useDocumentTitle(
    book ? `Checkout · ${book.title} · Nuestra Medicina Personal` : 'Checkout · Nuestra Medicina Personal',
  );

  useEffect(() => {
    if (!returningFromPayment || !storedOrderId || auth.status !== 'authenticated') return;

    const controller = new AbortController();
    apiRequest<OrderResponse>(orderUrl(storedOrderId), { signal: controller.signal })
      .then((order) => setVerification({ status: 'ready', order }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setVerification({ status: 'error' });
      });

    return () => controller.abort();
  }, [auth.status, returningFromPayment, storedOrderId, verificationAttempt]);

  if (catalog.status !== 'ready') {
    return (
      <div className={styles.page}>
        <GradientTopBar />
        <header className={styles.header}>
          <Link to="/" className={styles.logo}>
            <BrandMark />
            Nuestra Medicina Personal
          </Link>
        </header>
        <main className={styles.main}>
          <div className={styles.card} role={catalog.status === 'error' ? 'alert' : 'status'}>
            <p className={styles.body}>
              {catalog.status === 'loading' ? 'Cargando libro…' : 'No pudimos cargar el libro.'}
            </p>
            {catalog.status === 'error' && (
              <button type="button" className={styles.primaryAction} onClick={catalog.retry}>
                Reintentar
              </button>
            )}
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  if (!book) return <NotFoundPage />;

  let status: CheckoutStatus = 'pre';
  if (returningFromPayment) {
    if (!storedOrderId || auth.status === 'anonymous' || verification.status === 'error') status = 'error';
    else if (verification.status === 'checking') status = 'checking';
    else if (verification.order.status === 'PAID') status = 'approved';
    else if (verification.order.status === 'PENDING') status = 'pending';
    else status = 'failed';
  }

  const retryVerification = () => {
    setVerification({ status: 'checking' });
    setVerificationAttempt((value) => value + 1);
  };

  const handleContinue = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const order = await apiRequest<OrderResponse>(ORDERS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookSlug: book.slug }),
      });
      if (!order.checkoutUrl) throw new Error('Order has no checkout URL');
      storeCheckoutOrderId(book.slug, order.id);
      hardNavigate(order.checkoutUrl);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 429) {
        setCreateError('Alcanzaste el límite de intentos. Esperá un minuto y volvé a probar.');
      } else if (error instanceof ApiError && error.status === 503) {
        setCreateError('Los pagos todavía no están disponibles. Intentá nuevamente más tarde.');
      } else {
        setCreateError('No pudimos iniciar el pago. Intentá nuevamente.');
      }
      setCreating(false);
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
              {auth.status === 'authenticated' ? (
                <button
                  type="button"
                  className={styles.primaryAction}
                  onClick={handleContinue}
                  disabled={creating}
                >
                  {creating ? 'Preparando pago…' : 'Continuar con Mercado Pago'}
                </button>
              ) : (
                <Link to="/login" className={styles.primaryAction}>Iniciar sesión para comprar</Link>
              )}
              {createError && <p className={styles.errorText} role="alert">{createError}</p>}
              <p className={styles.fineprint}>
                Serás redirigido a Mercado Pago para completar el pago de forma segura.
              </p>
            </>
          )}

          {status === 'checking' && (
            <>
              <span className={[styles.statusIcon, styles.statusPending].join(' ')} aria-hidden="true">
                <span className={[styles.clockHand, styles.clockHandHour].join(' ')} />
                <span className={[styles.clockHand, styles.clockHandMinute].join(' ')} />
              </span>
              <h1 className={[styles.title, styles.titleWithGap].join(' ')}>Verificando tu compra</h1>
              <p className={styles.body}>Estamos consultando el estado confirmado de tu orden.</p>
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
              <p className={styles.body}>Mercado Pago todavía no confirmó la operación.</p>
              <button type="button" className={styles.primaryAction} onClick={retryVerification}>
                Volver a verificar
              </button>
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

          {status === 'error' && (
            <>
              <span className={[styles.statusIcon, styles.statusDanger].join(' ')} aria-hidden="true">!</span>
              <h1 className={[styles.title, styles.titleWithGap].join(' ')}>No pudimos verificar la compra</h1>
              <p className={styles.body}>
                No mostraremos la compra como aprobada hasta confirmarla con el servidor.
              </p>
              {storedOrderId && auth.status === 'authenticated' ? (
                <button type="button" className={styles.primaryAction} onClick={retryVerification}>
                  Reintentar verificación
                </button>
              ) : auth.status === 'anonymous' ? (
                <Link to="/login" className={styles.primaryAction}>Iniciar sesión</Link>
              ) : (
                <Link to={`/libros/${book.slug}`} className={styles.primaryAction}>Volver al libro</Link>
              )}
            </>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

