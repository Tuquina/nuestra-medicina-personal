import { SectionIntro } from '../../../shared/components/SectionIntro/SectionIntro';
import { BookCard } from '../../../shared/components/BookCard/BookCard';
import { PUBLISHED_BOOKS } from '../../data/books';
import styles from './FeaturedBooks.module.css';

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
        {PUBLISHED_BOOKS.map((book) => (
          <BookCard key={book.slug} book={book} />
        ))}
      </div>
    </section>
  );
}
