import { useState } from 'react';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { SiteFooter } from '../../../shared/components/SiteFooter/SiteFooter';
import { CollectionHero } from '../../../shared/components/CollectionHero/CollectionHero';
import { BookCard } from '../../../shared/components/BookCard/BookCard';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { PUBLISHED_BOOKS, CATALOG_FILTERS, type CatalogFilter } from '../../data/books';
import styles from './CatalogoPage.module.css';

/** `/libros` — the full catalog, filterable by collection. */
export function CatalogoPage() {
  useDocumentTitle('Libros · Nuestra Medicina Personal');

  const [filter, setFilter] = useState<CatalogFilter>('Todos');

  const visibleBooks =
    filter === 'Todos' ? PUBLISHED_BOOKS : PUBLISHED_BOOKS.filter((book) => book.category === filter);
  const showComingSoon = filter === 'Todos';
  const showEmpty = visibleBooks.length === 0 && !showComingSoon;

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
        {showEmpty ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              Todavía no hay libros publicados en esta categoría.
            </p>
            <button
              type="button"
              className={styles.emptyLink}
              onClick={() => setFilter('Todos')}
            >
              Ver todos los libros →
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {visibleBooks.map((book) => (
              <BookCard key={book.slug} book={book} compact />
            ))}

            {showComingSoon && (
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
