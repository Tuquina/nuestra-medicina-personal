import { Link } from 'react-router-dom';
import { PublicHeader } from '../../../shared/components/PublicHeader/PublicHeader';
import { PublicFooter } from '../../../shared/components/PublicFooter/PublicFooter';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { GOOGLE_AUTH_URL } from '../../../shared/config/api';
import styles from './LoginPage.module.css';

/**
 * `/login` — Google-only sign-in screen.
 *
 * There is no password login in this product (architecture.md §19): the
 * only entry point is "Continuar con Google", which does a full-page
 * navigation to the backend's OIDC start endpoint. That endpoint doesn't
 * exist yet (no Go backend), so the click currently 404s — the contract is
 * wired up correctly for when it does.
 */
export function LoginPage() {
  useDocumentTitle('Iniciar sesión · Nuestra Medicina Personal');

  return (
    <div className={styles.page}>
      <div className={styles.topBar} aria-hidden="true" />

      <PublicHeader />

      <main className={styles.main}>
        <div className={styles.glow} aria-hidden="true" />

        <div className={styles.card}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            Acceso
          </p>
          <h1 className={styles.title}>Iniciar sesión</h1>
          <p className={styles.subtitle}>
            Accedé a tus libros y compras desde un solo lugar.
          </p>

          <a className={styles.googleButton} href={GOOGLE_AUTH_URL}>
            <span className={styles.googleIcon} aria-hidden="true">
              G
            </span>
            Continuar con Google
          </a>

          <p className={styles.legal}>
            Al continuar, aceptás nuestros{' '}
            <Link to="/terminos">Términos</Link> y{' '}
            <Link to="/privacidad">Política de privacidad</Link>.
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
