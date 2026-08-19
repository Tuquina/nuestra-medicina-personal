import { Link } from 'react-router-dom';
import styles from './FinalCta.module.css';

interface FinalCtaProps {
  title: string;
  ctaHref: string;
  ctaLabel?: string;
  glowSide: 'left' | 'right';
}

/** The closing dark "buy now" banner used at the bottom of a book page. */
export function FinalCta({ title, ctaHref, ctaLabel = 'Comprar', glowSide }: FinalCtaProps) {
  return (
    <section className={styles.section}>
      <div
        className={[styles.glow, glowSide === 'left' ? styles.glowLeft : styles.glowRight].join(' ')}
        aria-hidden="true"
      />
      <div className={styles.inner}>
        <h2 className={styles.title}>{title}</h2>
        <Link to={ctaHref} className={styles.button}>
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
