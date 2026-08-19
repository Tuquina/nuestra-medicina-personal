import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { MinimalFooter } from '../../../shared/components/MinimalFooter/MinimalFooter';
import { Eyebrow } from '../../../shared/components/Eyebrow/Eyebrow';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { CURRENT_USER } from '../../data/currentUser';
import { BOOKS, type Book } from '../../data/books';
import { LIBRARY_ENTRIES } from '../../data/library';
import { LibraryBookCard } from './LibraryBookCard';
import styles from './BibliotecaPage.module.css';

interface OwnedBook {
  book: Book;
  purchasedAtLabel: string;
}

/** `/biblioteca` — the signed-in user's purchased books (architecture.md §27). */
export function BibliotecaPage() {
  useDocumentTitle('Mi biblioteca · Nuestra Medicina Personal');

  // The mockup ships a "(demo)" toggle to preview both states without a
  // second file — kept as-is since it's explicitly labeled as a demo
  // affordance, not something a real reader would see once §27's
  // GET /api/v1/me/books backs this for real.
  const [hasBooks, setHasBooks] = useState(true);

  const ownedBooks: OwnedBook[] = LIBRARY_ENTRIES.flatMap((entry) => {
    const book = BOOKS.find((candidate) => candidate.slug === entry.bookSlug);
    return book ? [{ book, purchasedAtLabel: entry.purchasedAtLabel }] : [];
  });

  return (
    <div className={styles.page}>
      <GradientTopBar />
      <SiteHeader user={CURRENT_USER} />

      <section className={styles.hero}>
        <div className={styles.glow} aria-hidden="true" />
        <div className={styles.heroRow}>
          <div>
            <div className={styles.eyebrow}>
              <Eyebrow>Tu espacio</Eyebrow>
            </div>
            <h1 className={`${styles.title} gradient-text`}>Mi biblioteca</h1>
          </div>
          <button type="button" className={styles.demoToggle} onClick={() => setHasBooks((v) => !v)}>
            {hasBooks ? 'Ver estado vacío (demo)' : 'Ver con libros (demo)'}
          </button>
        </div>
      </section>

      <section className={styles.content}>
        {hasBooks && ownedBooks.length > 0 ? (
          <div className={styles.grid}>
            {ownedBooks.map(({ book, purchasedAtLabel }) => (
              <LibraryBookCard key={book.slug} book={book} purchasedAtLabel={purchasedAtLabel} />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Todavía no tenés libros en tu biblioteca.</p>
            <p className={styles.emptyHint}>Explorá nuestros libros y encontrá el próximo para vos.</p>
            <Link to="/libros" className={styles.emptyCta}>
              Ver libros
            </Link>
          </div>
        )}
      </section>

      <MinimalFooter />
    </div>
  );
}
