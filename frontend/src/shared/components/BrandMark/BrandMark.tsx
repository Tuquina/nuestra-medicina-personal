import styles from './BrandMark.module.css';

/** The small radial-gradient circle used next to the wordmark. Decorative. */
export function BrandMark() {
  return <span className={styles.mark} aria-hidden="true" />;
}
