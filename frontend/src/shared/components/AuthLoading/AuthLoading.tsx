import styles from './AuthLoading.module.css';

/** Shown for the brief moment `AuthProvider` is waiting on `GET
 * /api/v1/me` — avoids flashing a logged-out or admin UI before
 * the real session state is known. */
export function AuthLoading() {
  return (
    <div className={styles.page}>
      <p className={styles.text}>Cargando…</p>
    </div>
  );
}
