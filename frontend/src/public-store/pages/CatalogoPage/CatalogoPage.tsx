import { useState } from 'react';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { SiteFooter } from '../../../shared/components/SiteFooter/SiteFooter';
import { CollectionHero } from '../../../shared/components/CollectionHero/CollectionHero';
import { BookCard } from '../../../shared/components/BookCard/BookCard';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useCatalog } from '../../catalog/useCatalog';
import { CATALOG_FILTERS, type CatalogFilter } from '../../data/books';
import styles from './CatalogoPage.module.css';

/** `/libros` — the full catalog, filterable by collection. */
export function CatalogoPage() {
  useDocumentTitle('Libros · Nuestra Medicina Personal');

  const [filter, setFilter] = useState<CatalogFilter>('Todos');
  const catalog = useCatalog();

  const visibleBooks = catalog.status === 'ready'
    ? filter === 'Todos'
      ? catalog.books
      : catalog.books.filter((book) => book.category === filter)
    : [];
  const showComingSoon = filter === 'Todos';
  const showEmpty = catalog.status === 'ready' && visibleBooks.length === 0;

  return (
    <div className={styles.page}>
      <GradientTopBar />
      <SiteHeader />

      <CollectionHero
        eyebrow="Colección"
        eyebrowColor="var(--color-accent-gold)"
        glowColor="var(--color-accent-amber-soft)"
        title="Libros"
        description="Escritura, educación y herramientas para acompañar procesos personales."
      />

      <section className={styles.filters}>
        <div className={styles.filterRow}>
          {CATALOG_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={[styles.filterButton, filter === option ? styles.filterButtonActive : '']
                .filter(Boolean)
                .join(' ')}
              aria-pressed={filter === option}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.gridSection}>
        {catalog.status === 'loading' ? (
          <div className={styles.resourceState} role="status">
            Cargando libros…
          </div>
        ) : catalog.status === 'error' ? (
          <div className={styles.resourceState} role="alert">
            <p>No pudimos cargar los libros.</p>
            <button type="button" className={styles.retryButton} onClick={catalog.retry}>
              Reintentar
            </button>
          </div>
        ) : showEmpty ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              {filter === 'Todos'
                ? 'Todavía no hay libros publicados.'
                : 'Todavía no hay libros publicados en esta categoría.'}
            </p>
            {filter !== 'Todos' && (
              <button
                type="button"
                className={styles.emptyLink}
                onClick={() => setFilter('Todos')}
              >
                Ver todos los libros →
              </button>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {visibleBooks.map((book) => (
              <BookCard key={book.slug} book={book} compact />
            ))}

            {showComingSoon && visibleBooks.length > 0 && (
              <article className={styles.comingSoon}>
                <div className={styles.comingSoonCover}>
                  <span className={styles.comingSoonCaption}>
                    Próximo libro — en preparación
                  </span>
                </div>
                <h3 className={styles.comingSoonTitle}>Muy pronto</h3>
                <p className={styles.comingSoonText}>
                  Estamos preparando un nuevo libro para esta colección.
                </p>
              </article>
            )}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
