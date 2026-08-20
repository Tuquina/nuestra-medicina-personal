import { Link } from 'react-router-dom';
import { BookCover } from '../../../shared/components/BookCover/BookCover';
import { downloadUrl } from '../../../shared/config/api';
import type { LibraryBookResponse } from '../../library/types';
import styles from './LibraryBookCard.module.css';

interface LibraryBookCardProps {
  book: LibraryBookResponse;
}

/** A single owned-book row: cover thumbnail, purchase date, download + details. */
export function LibraryBookCard({ book }: LibraryBookCardProps) {
  const purchasedAtLabel = new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(book.purchasedAt));

  return (
    <article className={styles.card}>
      <BookCover
        className={styles.cover}
        mediaId={book.coverMediaId}
        title={book.title}
        accent="color-mix(in oklch, var(--color-accent-gold) 50%, transparent)"
        borderRadius="4px"
      />
      <div className={styles.info}>
        <h3 className={styles.title}>{book.title}</h3>
        <p className={styles.purchasedAt}>{purchasedAtLabel}</p>
        <p className={styles.format}>{book.format}</p>
        <div className={styles.actions}>
          {book.downloadAvailable ? (
            <a href={downloadUrl(book.id)} className={styles.download}>
              Descargar
            </a>
          ) : (
            <span className={styles.downloadUnavailable}>Archivo no disponible</span>
          )}
          <Link to={`/libros/${book.slug}`} className={styles.details}>
            Ver detalles
          </Link>
        </div>
      </div>
    </article>
  );
}
