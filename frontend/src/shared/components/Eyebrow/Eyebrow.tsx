import type { CSSProperties, ReactNode } from 'react';
import styles from './Eyebrow.module.css';

interface EyebrowProps {
  children: ReactNode;
  /** CSS color value. Defaults to the warm gold used across most sections. */
  color?: string;
}

/** The small dot + uppercase label used to introduce most sections. */
export function Eyebrow({ children, color }: EyebrowProps) {
  const style = color ? ({ '--eyebrow-color': color } as CSSProperties) : undefined;

  return (
    <p className={styles.eyebrow} style={style}>
      <span className={styles.dot} aria-hidden="true" />
      {children}
    </p>
  );
}
