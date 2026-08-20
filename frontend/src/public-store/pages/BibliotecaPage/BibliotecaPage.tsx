import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { MinimalFooter } from '../../../shared/components/MinimalFooter/MinimalFooter';
import { Eyebrow } from '../../../shared/components/Eyebrow/Eyebrow';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useAuth } from '../../../shared/auth/useAuth';
import { apiRequest } from '../../../shared/api/client';
import { LIBRARY_URL } from '../../../shared/config/api';
import { AuthLoading } from '../../../shared/components/AuthLoading/AuthLoading';
import type { LibraryBookResponse, LibraryResponse } from '../../library/types';
import { LibraryBookCard } from './LibraryBookCard';
import styles from './BibliotecaPage.module.css';

type LibraryState =
  | { status: 'loading' }
  | { status: 'ready'; books: LibraryBookResponse[] }
  | { status: 'error' };

/** `/biblioteca` — the signed-in user's purchased books (architecture.md §27).
 * Only ever reached through the `RequireAuth` route guard. */
export function BibliotecaPage() {
  useDocumentTitle('Mi biblioteca · Nuestra Medicina Personal');
  const auth = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [library, setLibrary] = useState<LibraryState>({ status: 'loading' });
  const retry = useCallback(() => {
    setLibrary({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (auth.status !== 'authenticated') return;

    const controller = new AbortController();
    apiRequest<LibraryResponse>(LIBRARY_URL, { signal: controller.signal })
      .then((response) => setLibrary({ status: 'ready', books: response.items }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLibrary({ status: 'error' });
      });

    return () => controller.abort();
  }, [attempt, auth.status]);

  if (auth.status !== 'authenticated') return <AuthLoading />;

  return (
    <div className={styles.page}>
      <GradientTopBar />
      <SiteHeader />

      <section className={styles.hero}>
        <div className={styles.glow} aria-hidden="true" />
        <div className={styles.heroRow}>
          <div>
            <div className={styles.eyebrow}>
              <Eyebrow>Tu espacio</Eyebrow>
            </div>
            <h1 className={`${styles.title} gradient-text`}>Mi biblioteca</h1>
          </div>
        </div>
      </section>

      <section className={styles.content}>
        {library.status === 'loading' ? (
          <div className={styles.resourceState} role="status">Cargando tu biblioteca…</div>
        ) : library.status === 'error' ? (
          <div className={styles.resourceState} role="alert">
            <p>No pudimos cargar tu biblioteca.</p>
            <button type="button" className={styles.retryButton} onClick={retry}>
              Reintentar
            </button>
          </div>
        ) : library.books.length > 0 ? (
          <div className={styles.grid}>
            {library.books.map((book) => (
              <LibraryBookCard key={book.id} book={book} />
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
