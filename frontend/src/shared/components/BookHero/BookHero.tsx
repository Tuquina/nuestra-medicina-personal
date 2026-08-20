import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { BookCover } from '../BookCover/BookCover';
import { formatPrice } from '../../utils/money';
import type { Book } from '../../../public-store/data/books';
import styles from './BookHero.module.css';

const VARIANT_ACCENT: Record<Book['variant'], string> = {
  gold: 'color-mix(in oklch, var(--color-accent-gold) 50%, transparent)',
  blue: 'color-mix(in oklch, var(--color-sky) 60%, transparent)',
};

const VARIANT_BADGE_CLASS: Record<Book['variant'], string> = {
  gold: styles.badgeGold,
  blue: styles.badgeBlue,
};

interface BookHeroProps {
  book: Book;
  tagline: string;
  taglineColor: string;
  authorName: string;
  description: string;
  glowColor: string;
}

/** The above-the-fold book detail: cover, price, and the primary buy CTA. */
export function BookHero({ book, tagline, taglineColor, authorName, description, glowColor }: BookHeroProps) {
  return (
    <section className={styles.section}>
      <div className={styles.glow} style={{ '--glow-color': glowColor } as CSSProperties} aria-hidden="true" />

      <div className={styles.row}>
        <div className={styles.coverCol}>
          <BookCover
            className={styles.cover}
            mediaId={book.coverMediaId}
            title={book.title}
            accent={VARIANT_ACCENT[book.variant]}
            caption={book.coverCaption}
            borderRadius="6px"
          />
        </div>

        <div className={styles.textCol}>
          <span className={[styles.badge, VARIANT_BADGE_CLASS[book.variant]].join(' ')}>
            {book.category}
          </span>
          <h1 className={styles.title}>{book.title}</h1>
          <p className={styles.tagline} style={{ '--tagline-color': taglineColor } as CSSProperties}>
            {tagline}
          </p>
          <p className={styles.author}>{authorName}</p>
          <p className={styles.description}>{description}</p>

          <div className={styles.priceRow}>
            <span className={styles.price}>{formatPrice(book.priceMinorUnits, book.currency)}</span>
            <span className={styles.format}>{book.format}</span>
          </div>
          <Link to={`/checkout/${book.slug}`} className={styles.buyButton}>
            Comprar
          </Link>
          <p className={styles.paymentNote}>Pago seguro mediante Mercado Pago</p>
        </div>
      </div>
    </section>
  );
}
