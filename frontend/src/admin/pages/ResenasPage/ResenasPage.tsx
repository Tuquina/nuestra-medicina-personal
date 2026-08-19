import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { Dialog } from '../../../shared/components/Dialog/Dialog';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { toneForStatus } from '../../../shared/utils/statusTone';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { BOOKS } from '../../../public-store/data/books';
import { formatSaleDate } from '../DashboardPage/dashboardData';
import {
  deleteReview,
  getAllReviews,
  setReviewStatus,
  subscribeToReviews,
  type Review,
  type ReviewStatus,
} from '../../data/reviewsStore';
import styles from './ResenasPage.module.css';

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

const STATUS_FILTER_OPTIONS: (ReviewStatus | 'all')[] = ['all', 'pending', 'approved', 'rejected'];

function stars(rating: number): string {
  return '★★★★★'.slice(0, rating) + '☆☆☆☆☆'.slice(rating);
}

/**
 * `/admin/resenas` — one of architecture.md §6's future extensions.
 * Moderation only (approve/reject/delete) — reviews come from customers
 * on the public site, not created here. Own localStorage-backed store
 * (`reviewsStore.ts`), shaped for a real `/api/v1/admin/reviews`
 * endpoint later.
 */
export function ResenasPage() {
  useDocumentTitle('Reseñas · Admin · Nuestra Medicina Personal');

  const [reviews, setReviews] = useState<Review[]>(() => getAllReviews());
  useEffect(() => subscribeToReviews(() => setReviews(getAllReviews())), []);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'all'>('all');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const filtered = reviews.filter((review) => {
    const book = BOOKS.find((b) => b.slug === review.bookSlug);
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || review.customerName.toLowerCase().includes(q) || book?.title.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || review.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <AdminLayout title="Reseñas">
      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            type="text"
            placeholder="Buscar por cliente o libro..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.search}
            aria-label="Buscar por cliente o libro"
          />
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ReviewStatus | 'all')}
            aria-label="Filtrar por estado"
          >
            {STATUS_FILTER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'Todos los estados' : STATUS_LABEL[option]}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className={styles.emptyState}>Ninguna reseña coincide con estos filtros.</p>
        ) : (
          <div className={styles.list}>
            {filtered.map((review) => {
              const book = BOOKS.find((b) => b.slug === review.bookSlug);
              return (
                <div key={review.id} className={styles.reviewRow}>
                  <div className={styles.reviewMain}>
                    <div className={styles.reviewHeader}>
                      <span className={styles.customerName}>{review.customerName}</span>
                      <span className={styles.stars} aria-label={`${review.rating} de 5 estrellas`}>
                        {stars(review.rating)}
                      </span>
                      <span className={styles.bookTitle}>{book?.title ?? review.bookSlug}</span>
                    </div>
                    <p className={styles.reviewText}>{review.text}</p>
                    <span className={styles.reviewDate}>{formatSaleDate(review.createdAtISO)}</span>
                  </div>

                  <div className={styles.reviewActions}>
                    <StatusBadge tone={toneForStatus(STATUS_LABEL[review.status])}>
                      {STATUS_LABEL[review.status]}
                    </StatusBadge>
                    <div className={styles.actionButtons}>
                      {review.status !== 'approved' && (
                        <button
                          type="button"
                          className={[styles.actionButton, styles.actionButtonApprove].join(' ')}
                          onClick={() => setReviewStatus(review.id, 'approved')}
                        >
                          Aprobar
                        </button>
                      )}
                      {review.status !== 'rejected' && (
                        <button
                          type="button"
                          className={[styles.actionButton, styles.actionButtonReject].join(' ')}
                          onClick={() => setReviewStatus(review.id, 'rejected')}
                        >
                          Rechazar
                        </button>
                      )}
                    </div>
                    <button type="button" className={styles.deleteButton} onClick={() => setPendingDeleteId(review.id)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        title="¿Eliminar esta reseña?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (pendingDeleteId) deleteReview(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              Eliminar
            </Button>
          </>
        }
      >
        Esta acción no se puede deshacer.
      </Dialog>
    </AdminLayout>
  );
}
