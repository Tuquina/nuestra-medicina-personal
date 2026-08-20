import { SectionIntro } from '../../../shared/components/SectionIntro/SectionIntro';
import { BookCard } from '../../../shared/components/BookCard/BookCard';
import type { FeaturedBooksProps } from '../../../shared/cms/homeContent';
import { useCatalog } from '../../catalog/useCatalog';
import styles from './FeaturedBooks.module.css';

export function FeaturedBooks({ eyebrow, title, description }: FeaturedBooksProps) {
  const catalog = useCatalog();

  return (
    <section id="libros" className={styles.section}>
      <SectionIntro
        className={styles.intro}
        eyebrow={eyebrow}
        title={title}
        description={description}
        maxWidth="560px"
      />

      {catalog.status === 'loading' ? (
        <p className={styles.resourceState} role="status">Cargando libros…</p>
      ) : catalog.status === 'error' ? (
        <div className={styles.resourceState} role="alert">
          <p>No pudimos cargar los libros destacados.</p>
          <button type="button" className={styles.retryButton} onClick={catalog.retry}>
            Reintentar
          </button>
        </div>
      ) : catalog.books.length === 0 ? (
        <p className={styles.resourceState}>Próximamente vas a encontrar nuevos libros acá.</p>
      ) : (
        <div className={styles.grid}>
          {catalog.books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </section>
  );
}
