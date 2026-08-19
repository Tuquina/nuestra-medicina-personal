import { Link } from 'react-router-dom';
import { BrandMark } from '../BrandMark/BrandMark';
import styles from './PublicHeader.module.css';

/**
 * Minimal public-site header: wordmark + logo, linking home.
 *
 * The mockup's header carries no navigation on the Login page (it's a
 * focused, distraction-free screen), so this stays intentionally bare.
 * Extend it once the Home/Catálogo pages exist.
 */
export function PublicHeader() {
  return (
    <header className={styles.header}>
      <Link to="/" className={styles.logoLink}>
        <BrandMark />
        Nuestra Medicina Personal
      </Link>
    </header>
  );
}
