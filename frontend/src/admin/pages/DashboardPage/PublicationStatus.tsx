import { Link } from 'react-router-dom';
import { BOOKS } from '../../../public-store/data/books';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { toneForStatus } from '../../../shared/utils/statusTone';
import styles from './DashboardPage.module.css';

const STATUS_LABEL: Record<(typeof BOOKS)[number]['status'], string> = {
  PUBLISHED: 'Publicado',
  DRAFT: 'Borrador',
  ARCHIVED: 'Archivado',
};

/** Publication status of every book, admin-only (uses the full BOOKS, not PUBLISHED_BOOKS). */
export function PublicationStatus() {
  return (
    <div className={[styles.panel, styles.panelInner].join(' ')}>
      <h2 className={styles.panelTitle}>Estado de publicación</h2>
      <div className={styles.statusList}>
        {BOOKS.map((book) => {
          const label = STATUS_LABEL[book.status];
          return (
            <div key={book.slug} className={styles.statusRow}>
              <span className={styles.statusRowLabel}>{book.title}</span>
              <StatusBadge tone={toneForStatus(label)}>{label}</StatusBadge>
            </div>
          );
        })}
      </div>
      <Link to="/admin/libros" className={styles.statusLink}>
        Ver todos los libros →
      </Link>
    </div>
  );
}
