import { Link } from 'react-router-dom';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { toneForStatus } from '../../../shared/utils/statusTone';
import type { AdminBook } from '../../books/types';
import styles from './DashboardPage.module.css';

const STATUS_LABEL: Record<AdminBook['status'], string> = {
  PUBLISHED: 'Publicado',
  DRAFT: 'Borrador',
  ARCHIVED: 'Archivado',
};

export function PublicationStatus({ books }: { books: AdminBook[] }) {
  return (
    <div className={[styles.panel, styles.panelInner].join(' ')}>
      <h2 className={styles.panelTitle}>Estado de publicación</h2>
      <div className={styles.statusList}>
        {books.map((book) => {
          const label = STATUS_LABEL[book.status];
          return (
            <div key={book.slug} className={styles.statusRow}>
              <span className={styles.statusRowLabel}>{book.title}</span>
              <StatusBadge tone={toneForStatus(label)}>{label}</StatusBadge>
            </div>
          );
        })}
        {books.length === 0 && <p className={styles.emptyRow}>Todavía no hay libros.</p>}
      </div>
      <Link to="/admin/libros" className={styles.statusLink}>
        Ver todos los libros →
      </Link>
    </div>
  );
}
