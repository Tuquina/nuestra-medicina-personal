import styles from './Manifesto.module.css';

export function Manifesto() {
  return (
    <section className={styles.section}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.inner}>
        <span className={styles.mark} aria-hidden="true" />
        <p className={styles.quote}>Hay historias que también nos ayudan a mirarnos.</p>
        <p className={styles.body}>
          Nuestra Medicina Personal reúne escritura, reflexión y herramientas
          para acompañar procesos de exploración personal y educativa.
        </p>
      </div>
    </section>
  );
}
