import { Link } from 'react-router-dom';
import { SectionIntro } from '../../../shared/components/SectionIntro/SectionIntro';
import { ImagePlaceholder } from '../../../shared/components/ImagePlaceholder/ImagePlaceholder';
import { FEATURED_BOOKS } from '../../data/books';
import { formatPrice } from '../../../shared/utils/money';
import styles from './FeaturedBooks.module.css';

const VARIANT_ACCENT: Record<'gold' | 'blue', string> = {
  gold: 'color-mix(in oklch, var(--color-accent-gold) 50%, transparent)',
  blue: 'color-mix(in oklch, var(--color-sky) 60%, transparent)',
};

const VARIANT_BADGE_CLASS: Record<'gold' | 'blue', string> = {
  gold: styles.badgeGold,
  blue: styles.badgeBlue,
};

export function FeaturedBooks() {
  return (
    <section id="libros" className={styles.section}>
      <SectionIntro
        className={styles.intro}
        eyebrow="Colección"
        title="Libros destacados"
        description="Escritura y educación para acompañar tus propios procesos."
        maxWidth="560px"
      />

      <div className={styles.grid}>
        {FEATURED_BOOKS.map((book) => (
          <article key={book.slug} className={styles.card}>
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
            <div className={styles.footerRow}>
              <span className={styles.price}>
                {formatPrice(book.priceMinorUnits, book.currency)}
              </span>
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
