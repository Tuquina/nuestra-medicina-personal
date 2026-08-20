import { Link } from 'react-router-dom';
import { BookCover } from '../BookCover/BookCover';
import { formatPrice } from '../../utils/money';
import type { Book } from '../../../public-store/data/books';
import styles from './RelatedBooks.module.css';

const VARIANT_ACCENT: Record<Book['variant'], string> = {
  gold: 'color-mix(in oklch, var(--color-accent-gold) 50%, transparent)',
  blue: 'color-mix(in oklch, var(--color-sky) 60%, transparent)',
};

interface RelatedBooksProps {
  books: Book[];
}

/** "También te puede interesar" — a lighter-weight card than `BookCard`. */
export function RelatedBooks({ books }: RelatedBooksProps) {
  if (books.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>También te puede interesar</h2>
      <div className={styles.grid}>
        {books.map((book) => (
          <article key={book.slug} className={styles.card}>
            <BookCover
              className={styles.cover}
              mediaId={book.coverMediaId}
              title={book.title}
              accent={VARIANT_ACCENT[book.variant]}
              caption={book.coverCaption}
              borderRadius="4px"
            />
            <h3 className={styles.title}>{book.title}</h3>
            <div className={styles.footerRow}>
              <span className={styles.price}>{formatPrice(book.priceMinorUnits, book.currency)}</span>
              <Link to={`/libros/${book.slug}`} className={styles.link}>
                Ver libro →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
