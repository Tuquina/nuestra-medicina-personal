import styles from './FeatureGrid.module.css';

interface FeatureGridProps {
  /** Omit when the surrounding page already has its own heading (e.g. a
   * hero title) — a book landing page's middle section still wants its
   * own. */
  heading?: string;
  items: { title: string; description: string }[];
}

/** A centered 3(ish)-column "what you'll find" benefits grid. */
export function FeatureGrid({ heading, items }: FeatureGridProps) {
  return (
    <section className={styles.section}>
      {heading && <h2 className={styles.heading}>{heading}</h2>}
      <div className={styles.grid}>
        {items.map((item) => (
          <div key={item.title} className={styles.item}>
            <span className={styles.dot} aria-hidden="true" />
            <h3 className={styles.itemTitle}>{item.title}</h3>
            <p className={styles.itemText}>{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
