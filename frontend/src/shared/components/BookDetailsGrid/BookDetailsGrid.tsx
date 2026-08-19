import styles from './BookDetailsGrid.module.css';

interface BookDetailsGridProps {
  details: { label: string; value: string }[];
}

/** The "Datos del libro" spec table (format, author, ISBN, etc.). */
export function BookDetailsGrid({ details }: BookDetailsGridProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Datos del libro</h2>
      <div className={styles.grid}>
        {details.map((item) => (
          <div key={item.label}>
            <p className={styles.label}>{item.label}</p>
            <p className={styles.value}>{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
