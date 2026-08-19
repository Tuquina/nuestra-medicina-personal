import { Link } from 'react-router-dom';
import { ImagePlaceholder } from '../../../shared/components/ImagePlaceholder/ImagePlaceholder';
import { downloadUrl } from '../../../shared/config/api';
import type { Book } from '../../data/books';
import styles from './LibraryBookCard.module.css';

const VARIANT_ACCENT: Record<Book['variant'], string> = {
  gold: 'color-mix(in oklch, var(--color-accent-gold) 50%, transparent)',
  blue: 'color-mix(in oklch, var(--color-sky) 60%, transparent)',
};

interface LibraryBookCardProps {
  book: Book;
  purchasedAtLabel: string;
}

/** A single owned-book row: cover thumbnail, purchase date, download + details. */
export function LibraryBookCard({ book, purchasedAtLabel }: LibraryBookCardProps) {
  return (
    <article className={styles.card}>
      <ImagePlaceholder
        className={styles.cover}
        accent={VARIANT_ACCENT[book.variant]}
        alt={`Portada — ${book.title}`}
        aspectRatio="2 / 3"
        borderRadius="4px"
      />
      <div className={styles.info}>
        <h3 className={styles.title}>{book.title}</h3>
        <p className={styles.purchasedAt}>{purchasedAtLabel}</p>
        <p className={styles.format}>{book.format}</p>
        <div className={styles.actions}>
          {/* Real download contract (architecture.md §28) — 404s locally
              until the backend exists, same treatment as the other
              backend-dependent actions in this app. */}
          <a href={downloadUrl(book.slug)} className={styles.download}>
            Descargar
          </a>
          <Link to={`/libros/${book.slug}`} className={styles.details}>
            Ver detalles
          </Link>
        </div>
      </div>
    </article>
  );
}
