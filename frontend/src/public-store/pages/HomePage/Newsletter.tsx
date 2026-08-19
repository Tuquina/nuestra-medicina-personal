import { useState, type FormEvent } from 'react';
import styles from './Newsletter.module.css';

/**
 * Local-only demo state — there's no `/api/v1/newsletter*` endpoint in
 * architecture.md yet (marketing_subscriptions is described conceptually
 * in §59.13 but not wired to an API contract). Wire this up to a real
 * endpoint once one exists instead of inventing a shape now.
 */
export function Newsletter() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) return;
    setSubscribed(true);
  };

  return (
    <section id="novedades" className={styles.section}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.inner}>
        <h2 className={styles.title}>Recibí nuestras novedades</h2>
        <p className={styles.subtitle}>
          Nuevos libros, meditaciones y contenidos directamente en tu correo.
        </p>

        {subscribed ? (
          <p className={styles.confirmation}>
            Gracias — ya estás suscripto/a. Podés darte de baja cuando
            quieras.
          </p>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="newsletter-email">
              Correo electrónico
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              placeholder="Correo electrónico"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={styles.input}
            />
            <button type="submit" className={styles.submit}>
              Quiero recibir novedades
            </button>
          </form>
        )}

        <p className={styles.fineprint}>
          Podés darte de baja cuando quieras. Nunca compartimos tu correo.
        </p>
      </div>
    </section>
  );
}
