import { useState, type FormEvent } from 'react';
import { NEWSLETTER_SUBSCRIBE_URL } from '../../config/api';
import { apiRequest } from '../../api/client';
import styles from './NewsletterSignup.module.css';

interface NewsletterSignupProps {
  title: string;
  subtitle?: string;
  buttonLabel: string;
  confirmationText: string;
  fineprint?: string;
  sectionId?: string;
}

/**
 * The dark radial-gradient email capture used on Home, Meditaciones and
 * Herramientas. Posts to `POST /api/v1/newsletter/subscribe` — public,
 * idempotent by email (architecture.md §59.13).
 */
export function NewsletterSignup({
  title,
  subtitle,
  buttonLabel,
  confirmationText,
  fineprint,
  sectionId,
}: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(NEWSLETTER_SUBSCRIBE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: sectionId ?? 'unknown' }),
      });
      setSubscribed(true);
    } catch {
      setError('No pudimos guardar tu suscripción. Intentá nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputId = `newsletter-email${sectionId ? `-${sectionId}` : ''}`;

  return (
    <section id={sectionId} className={styles.section}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.inner}>
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}

        {subscribed ? (
          <p className={styles.confirmation}>{confirmationText}</p>
        ) : (
          <form
            className={[styles.form, subtitle ? styles.withSubtitle : styles.noSubtitle].join(' ')}
            onSubmit={handleSubmit}
          >
            <label className="sr-only" htmlFor={inputId}>
              Correo electrónico
            </label>
            <input
              id={inputId}
              type="email"
              required
              placeholder="Correo electrónico"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={styles.input}
              disabled={submitting}
            />
            <button type="submit" className={styles.submit} disabled={submitting}>
              {submitting ? 'Enviando…' : buttonLabel}
            </button>
          </form>
        )}

        {error && <p className={styles.error}>{error}</p>}
        {fineprint && <p className={styles.fineprint}>{fineprint}</p>}
      </div>
    </section>
  );
}
