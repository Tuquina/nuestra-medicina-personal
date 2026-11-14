import { useSiteSettings } from '../../site/siteSettings';
import styles from './MinimalFooter.module.css';

/**
 * A copyright-only footer (no sitemap columns) for the collection and
 * tool pages. Site name and support email come from Configuración.
 */
export function MinimalFooter() {
  const year = new Date().getFullYear();
  const site = useSiteSettings();

  return (
    <footer className={styles.footer}>
      <p className={styles.text}>
        © {year} {site.siteName} · <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>
      </p>
    </footer>
  );
}
