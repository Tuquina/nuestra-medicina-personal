import styles from './QuoteBanner.module.css';

interface QuoteBannerProps {
  quote: string;
  glowSide: 'left' | 'right';
}

/** The centered italic pull-quote section shared by both book landings. */
export function QuoteBanner({ quote, glowSide }: QuoteBannerProps) {
  return (
    <section className={styles.section}>
      <div
        className={[styles.glow, glowSide === 'left' ? styles.glowLeft : styles.glowRight].join(' ')}
        aria-hidden="true"
      />
      <p className={styles.quote}>{quote}</p>
    </section>
  );
}
