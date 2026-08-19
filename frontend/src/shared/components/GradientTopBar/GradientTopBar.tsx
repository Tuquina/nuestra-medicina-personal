import styles from './GradientTopBar.module.css';

/** The 3px brand-gradient hairline fixed to the top of every page. */
export function GradientTopBar() {
  return <div className={styles.bar} aria-hidden="true" />;
}
