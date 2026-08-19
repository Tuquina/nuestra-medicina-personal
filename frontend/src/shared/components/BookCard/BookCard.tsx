import { Link } from 'react-router-dom';
import { ImagePlaceholder } from '../ImagePlaceholder/ImagePlaceholder';
import { formatPrice } from '../../utils/money';
import type { Book } from '../../../public-store/data/books';
import styles from './BookCard.module.css';

const VARIANT_ACCENT: Record<Book['variant'], string> = {
  gold: 'color-mix(in oklch, var(--color-accent-gold) 50%, transparent)',
  blue: 'color-mix(in oklch, var(--color-sky) 60%, transparent)',
};

const VARIANT_BADGE_CLASS: Record<Book['variant'], string> = {
  gold: styles.badgeGold,
  blue: styles.badgeBlue,
};

interface BookCardProps {
  book: Book;
  /** Denser type scale + format line, used on the catalog listing. */
  compact?: boolean;
}

/** A single book's cover + metadata, used on the Home and Catálogo grids. */
export function BookCard({ book, compact = false }: BookCardProps) {
  return (
    <article className={[styles.card, compact ? styles.compact : ''].join(' ')}>
      <ImagePlaceholder
        className={styles.cover}
        accent={VARIANT_ACCENT[book.variant]}
        caption={book.coverCaption}
        aspectRatio="2 / 3"
        borderRadius="4px"
      />
      <span className={[styles.badge, VARIANT_BADGE_CLASS[book.variant]].join(' ')}>
        {book.category}
      </span>
      <h3 className={styles.title}>{book.title}</h3>
      <p className={styles.description}>{book.shortDescription}</p>
      {compact && <p className={styles.format}>{book.format}</p>}
      <div className={styles.footerRow}>
        <span className={styles.price}>{formatPrice(book.priceMinorUnits, book.currency)}</span>
        <Link to={`/libros/${book.slug}`} className={styles.link}>
          Ver libro →
        </Link>
      </div>
    </article>
  );
}
