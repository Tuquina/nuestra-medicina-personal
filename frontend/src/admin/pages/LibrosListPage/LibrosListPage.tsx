import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { BookCover } from '../../../shared/components/BookCover/BookCover';
import { formatPrice } from '../../../shared/utils/money';
import { relativeDaysEs } from '../../../shared/utils/relativeTime';
import { toneForStatus } from '../../../shared/utils/statusTone';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { apiRequest, ApiError } from '../../../shared/api/client';
import { ADMIN_BOOKS_URL, adminBookUrl } from '../../../shared/config/api';
import type { AdminBook, AdminBookList } from '../../books/types';
import styles from './LibrosListPage.module.css';

const STATUS_LABEL: Record<AdminBook['status'], string> = {
  PUBLISHED: 'Publicado',
  DRAFT: 'Borrador',
  ARCHIVED: 'Archivado',
};

const VARIANT_ACCENT: Record<AdminBook['variant'], string> = {
  gold: 'color-mix(in oklch, var(--color-accent-gold) 50%, transparent)',
  blue: 'color-mix(in oklch, var(--color-sky) 60%, transparent)',
};

type BooksState =
  | { status: 'loading' }
  | { status: 'ready'; books: AdminBook[] }
  | { status: 'error' };

/** `/admin/libros` — all books, including drafts and archived records. */
export function LibrosListPage() {
  useDocumentTitle('Libros · Admin · Nuestra Medicina Personal');

  const [state, setState] = useState<BooksState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<AdminBookList>(ADMIN_BOOKS_URL, { signal: controller.signal })
      .then((response) => setState({ status: 'ready', books: response.items }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [attempt]);

  const books = state.status === 'ready' ? state.books : [];
  const filtered = books.filter((book) =>
    book.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const handleArchive = async (book: AdminBook) => {
    setArchivingId(book.id);
    setActionError(null);
    try {
      await apiRequest<void>(adminBookUrl(book.id), { method: 'DELETE' });
      setState((current) =>
        current.status === 'ready'
          ? {
              status: 'ready',
              books: current.books.map((item) =>
                item.id === book.id ? { ...item, status: 'ARCHIVED' } : item,
              ),
            }
          : current,
      );
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 429) {
        setActionError('Alcanzaste el límite de operaciones. Esperá un minuto y reintentá.');
      } else {
        setActionError('No pudimos archivar el libro. Intentá nuevamente.');
      }
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <AdminLayout
      title="Libros"
      headerActions={
        <Button variant="primary" to="/admin/libros/nuevo">Nuevo libro</Button>
      }
    >
      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            type="text"
            placeholder="Buscar libros..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={styles.search}
            aria-label="Buscar libros"
          />
          <span className={styles.count}>
            {filtered.length} {filtered.length === 1 ? 'libro' : 'libros'}
          </span>
        </div>

        {actionError && <p className={styles.actionError} role="alert">{actionError}</p>}
        {state.status === 'loading' ? (
          <p className={styles.emptyState} role="status">Cargando libros…</p>
        ) : state.status === 'error' ? (
          <div className={styles.emptyState} role="alert">
            <p>No pudimos cargar los libros.</p>
            <Button variant="secondary" onClick={retry}>Reintentar</Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className={styles.emptyState}>
            {query ? `Ningún libro coincide con “${query}”.` : 'Todavía no hay libros.'}
          </p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Portada</th>
                  <th>Título</th>
                  <th>Precio</th>
                  <th>Formato</th>
                  <th>Estado</th>
                  <th>Última actualización</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((book) => (
                  <tr key={book.id}>
                    <td className={styles.cover}>
                      {book.hasCover ? (
                        <BookCover
                          mediaId={book.coverMediaId}
                          title={book.title}
                          accent={VARIANT_ACCENT[book.variant]}
                          borderRadius="3px"
                        />
                      ) : (
                        <div className={styles.coverPlaceholder} title="Sin portada" />
                      )}
                    </td>
                    <td className={styles.titleCell}>{book.title}</td>
                    <td>{book.priceMinorUnits ? formatPrice(book.priceMinorUnits, book.currency) : '—'}</td>
                    <td className={styles.formatCell}>{book.format}</td>
                    <td>
                      <StatusBadge tone={toneForStatus(STATUS_LABEL[book.status])}>
                        {STATUS_LABEL[book.status]}
                      </StatusBadge>
                    </td>
                    <td className={styles.dateCell}>{relativeDaysEs(book.updatedAt, new Date())}</td>
                    <td className={styles.actions}>
                      <Link to={`/admin/libros/${book.slug}/editar`} className={styles.editLink}>Editar</Link>
                      {book.status === 'PUBLISHED' && (
                        <Link to="/admin/paginas" className={styles.secondaryLink}>Editar página</Link>
                      )}
                      {book.status !== 'ARCHIVED' && (
                        <button
                          type="button"
                          className={styles.secondaryLink}
                          disabled={archivingId === book.id}
                          onClick={() => handleArchive(book)}
                        >
                          {archivingId === book.id ? 'Archivando…' : 'Archivar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
