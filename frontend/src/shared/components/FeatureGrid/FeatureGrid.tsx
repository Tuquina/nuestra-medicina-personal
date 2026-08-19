import styles from './FeatureGrid.module.css';

interface FeatureGridProps {
  heading: string;
  items: { title: string; description: string }[];
}

/** A centered 3(ish)-column "what you'll find" benefits grid. */
export function FeatureGrid({ heading, items }: FeatureGridProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{heading}</h2>
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
