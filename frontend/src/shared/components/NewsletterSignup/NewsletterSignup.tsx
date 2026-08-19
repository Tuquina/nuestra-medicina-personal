import { useState, type FormEvent } from 'react';
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
 * Herramientas. Local-only state — there's no `/api/v1/newsletter*`
 * endpoint in architecture.md yet (marketing_subscriptions is described
 * conceptually in §59.13 but not wired to an API contract). Wire this up
 * to a real endpoint once one exists instead of inventing a shape now.
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) return;
    setSubscribed(true);
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
            />
            <button type="submit" className={styles.submit}>
              {buttonLabel}
            </button>
          </form>
        )}

        {fineprint && <p className={styles.fineprint}>{fineprint}</p>}
      </div>
    </section>
  );
}
