import styles from './PublicFooter.module.css';

const SUPPORT_EMAIL = 'soporte@nuestramedicinapersonal.com';

/** Minimal public-site footer: copyright + support contact. */
export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <p className={styles.text}>
        © {year} Nuestra Medicina Personal · {SUPPORT_EMAIL}
      </p>
    </footer>
  );
}
