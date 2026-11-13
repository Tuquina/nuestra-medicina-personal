import { useId, type ReactNode } from 'react';
import styles from './ToolPanel.module.css';

interface ToolPanelProps {
  title: string;
  hint?: string;
  /** Right-aligned actions next to the title (e.g. "Descargar"). */
  actions?: ReactNode;
  /** "paper" is the warm writing surface; "plain" a lighter, borderless block. */
  tone?: 'paper' | 'plain';
  children: ReactNode;
}

/** A titled section inside a tool page. */
export function ToolPanel({ title, hint, actions, tone = 'paper', children }: ToolPanelProps) {
  const headingId = useId();
  return (
    <section className={`${styles.panel} ${styles[tone]}`} aria-labelledby={headingId}>
      <div className={styles.header}>
        <div>
          <h2 id={headingId} className={styles.title}>
            {title}
          </h2>
          {hint && <p className={styles.hint}>{hint}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {children}
    </section>
  );
}
