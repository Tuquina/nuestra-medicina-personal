import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { ImagePlaceholder } from '../../../shared/components/ImagePlaceholder/ImagePlaceholder';
import { formatPrice } from '../../../shared/utils/money';
import { relativeDaysEs } from '../../../shared/utils/relativeTime';
import { toneForStatus } from '../../../shared/utils/statusTone';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { BOOKS, type Book } from '../../../public-store/data/books';
import { ADMIN_NOW } from '../../adminNow';
import styles from './LibrosListPage.module.css';

const STATUS_LABEL: Record<Book['status'], string> = {
  PUBLISHED: 'Publicado',
  DRAFT: 'Borrador',
  ARCHIVED: 'Archivado',
};

const VARIANT_ACCENT: Record<Book['variant'], string> = {
  gold: 'color-mix(in oklch, var(--color-accent-gold) 50%, transparent)',
  blue: 'color-mix(in oklch, var(--color-sky) 60%, transparent)',
};

/** `/admin/libros` — every book, any status, built from Admin Libros.dc.html. */
export function LibrosListPage() {
  useDocumentTitle('Libros · Admin · Nuestra Medicina Personal');

  const [query, setQuery] = useState('');

  const filtered = BOOKS.filter((book) => book.title.toLowerCase().includes(query.trim().toLowerCase()));

  const handleArchive = async (book: Book) => {
    try {
      await fetch(`/api/v1/admin/books/${book.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ARCHIVED' }),
      });
    } catch {
      // Mock reconciliation and API error states are part of the final
      // transport integration.
    }
  };

  return (
    <AdminLayout
      title="Libros"
      headerActions={
        <Button variant="primary" to="/admin/libros/nuevo">
          Nuevo libro
        </Button>
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

        {filtered.length === 0 ? (
          <p className={styles.emptyState}>Ningún libro coincide con "{query}".</p>
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
                  <tr key={book.slug}>
                    <td className={styles.cover}>
                      {book.hasCover ? (
                        <ImagePlaceholder
                          accent={VARIANT_ACCENT[book.variant]}
                          alt={book.coverCaption}
                          aspectRatio="2 / 3"
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
                    <td className={styles.dateCell}>{relativeDaysEs(book.updatedAtISO, ADMIN_NOW)}</td>
                    <td className={styles.actions}>
                      <Link to={`/admin/libros/${book.slug}/editar`} className={styles.editLink}>
                        Editar
                      </Link>
                      {book.status === 'PUBLISHED' ? (
                        <Link to="/admin/paginas" className={styles.secondaryLink}>
                          Editar página
                        </Link>
                      ) : (
                        <button type="button" className={styles.secondaryLink} onClick={() => handleArchive(book)}>
                          Archivar
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
