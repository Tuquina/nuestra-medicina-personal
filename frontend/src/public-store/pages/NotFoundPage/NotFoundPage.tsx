import { Link } from 'react-router-dom';
import { PublicHeader } from '../../../shared/components/PublicHeader/PublicHeader';
import { PublicFooter } from '../../../shared/components/PublicFooter/PublicFooter';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import styles from './NotFoundPage.module.css';

/**
 * Fallback for unimplemented/unknown routes (e.g. `/terminos`,
 * `/privacidad`, and any path outside the current scope). Intentionally
 * bare — most of the site isn't built yet.
 */
export function NotFoundPage() {
  useDocumentTitle('Página no encontrada · Nuestra Medicina Personal');

  return (
    <div className={styles.page}>
      <PublicHeader />
      <main className={styles.main}>
        <h1 className={styles.title}>Página no encontrada</h1>
        <p className={styles.text}>Esta sección todavía no está disponible.</p>
        <Link to="/login" className={styles.link}>
          Volver a Iniciar sesión
        </Link>
      </main>
      <PublicFooter />
    </div>
  );
}
