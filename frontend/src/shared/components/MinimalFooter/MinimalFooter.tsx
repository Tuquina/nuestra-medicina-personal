import styles from './MinimalFooter.module.css';

const SUPPORT_EMAIL = 'soporte@nuestramedicinapersonal.com';

/**
 * A copyright-only footer (no sitemap columns) — used by pages that are
 * still "coming soon" placeholders (Meditaciones, Herramientas), where
 * the full `SiteFooter` sitemap would be premature.
 */
export function MinimalFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <p className={styles.text}>
        © {year} Nuestra Medicina Personal · {SUPPORT_EMAIL}
      </p>
    </footer>
  );
}
