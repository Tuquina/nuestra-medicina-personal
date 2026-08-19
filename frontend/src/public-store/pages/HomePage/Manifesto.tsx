import type { ManifestoProps } from '../../../shared/cms/homeContent';
import styles from './Manifesto.module.css';

export function Manifesto({ quote, body }: ManifestoProps) {
  return (
    <section className={styles.section}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.inner}>
        <span className={styles.mark} aria-hidden="true" />
        <p className={styles.quote}>{quote}</p>
        <p className={styles.body}>{body}</p>
      </div>
    </section>
  );
}
