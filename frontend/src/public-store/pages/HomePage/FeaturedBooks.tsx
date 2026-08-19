import { SectionIntro } from '../../../shared/components/SectionIntro/SectionIntro';
import { BookCard } from '../../../shared/components/BookCard/BookCard';
import { PUBLISHED_BOOKS } from '../../data/books';
import type { FeaturedBooksProps } from '../../../shared/cms/homeContent';
import styles from './FeaturedBooks.module.css';

export function FeaturedBooks({ eyebrow, title, description }: FeaturedBooksProps) {
  return (
    <section id="libros" className={styles.section}>
      <SectionIntro
        className={styles.intro}
        eyebrow={eyebrow}
        title={title}
        description={description}
        maxWidth="560px"
      />

      <div className={styles.grid}>
        {PUBLISHED_BOOKS.map((book) => (
          <BookCard key={book.slug} book={book} />
        ))}
      </div>
    </section>
  );
}
