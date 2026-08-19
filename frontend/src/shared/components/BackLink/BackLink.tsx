import { Link } from 'react-router-dom';
import styles from './BackLink.module.css';

interface BackLinkProps {
  to: string;
  children: string;
}

/** The small "← Volver a…" breadcrumb above a detail page's hero. */
export function BackLink({ to, children }: BackLinkProps) {
  return (
    <div className={styles.wrapper}>
      <Link to={to} className={styles.link}>
        ← {children}
      </Link>
    </div>
  );
}
