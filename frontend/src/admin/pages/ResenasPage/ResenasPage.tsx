import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { Dialog } from '../../../shared/components/Dialog/Dialog';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { toneForStatus } from '../../../shared/utils/statusTone';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { apiRequest } from '../../../shared/api/client';
import { ADMIN_REVIEWS_URL, adminReviewStatusUrl, adminReviewUrl } from '../../../shared/config/api';
import styles from './ResenasPage.module.css';

type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
interface Review { id: string; bookId: string; bookSlug: string; bookTitle: string; customerName: string; rating: number; body: string; status: ReviewStatus; createdAt: string; updatedAt: string }
interface ReviewList { items: Review[]; total: number }
const STATUS_LABEL: Record<ReviewStatus, string> = { PENDING: 'Pendiente', APPROVED: 'Aprobada', REJECTED: 'Rechazada' };
const STATUS_FILTER_OPTIONS: Array<ReviewStatus | 'ALL'> = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];
const stars = (rating: number) => '★★★★★'.slice(0, rating) + '☆☆☆☆☆'.slice(rating);
const formatDate = (value: string) => new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(value));

export function ResenasPage() {
  useDocumentTitle('Reseñas · Admin · Nuestra Medicina Personal');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'ALL'>('ALL');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try { const page = await apiRequest<ReviewList>(ADMIN_REVIEWS_URL, { signal }); setReviews(page.items); setLoadStatus('ready'); }
    catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; setLoadStatus('error'); }
  }, []);
  // The state changes happen after the API promise settles.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);

  const filtered = reviews.filter((review) => {
    const normalized = query.trim().toLowerCase();
    return (!normalized || review.customerName.toLowerCase().includes(normalized) || review.bookTitle.toLowerCase().includes(normalized)) && (statusFilter === 'ALL' || review.status === statusFilter);
  });
  const moderate = async (id: string, status: ReviewStatus) => {
    setActionError(false);
    try { await apiRequest<Review>(adminReviewStatusUrl(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); await load(); }
    catch { setActionError(true); }
  };
  const remove = async () => {
    if (!pendingDeleteId) return;
    setActionError(false);
    try { await apiRequest<void>(adminReviewUrl(pendingDeleteId), { method: 'DELETE' }); setPendingDeleteId(null); await load(); }
    catch { setActionError(true); }
  };

  return <AdminLayout title="Reseñas"><div className={styles.panel}>
    <div className={styles.toolbar}><input type="text" placeholder="Buscar por cliente o libro..." value={query} onChange={(event) => setQuery(event.target.value)} className={styles.search} aria-label="Buscar por cliente o libro" />
      <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ReviewStatus | 'ALL')} aria-label="Filtrar por estado">{STATUS_FILTER_OPTIONS.map((option) => <option key={option} value={option}>{option === 'ALL' ? 'Todos los estados' : STATUS_LABEL[option]}</option>)}</select></div>
    {actionError && <p className={styles.emptyState} role="alert">No pudimos completar la acción. Intentá nuevamente.</p>}
    {loadStatus === 'loading' ? <p className={styles.emptyState}>Cargando reseñas…</p> : loadStatus === 'error' ? <div className={styles.emptyState}><p>No pudimos cargar las reseñas.</p><Button variant="secondary" onClick={() => { setLoadStatus('loading'); void load(); }}>Reintentar</Button></div> : filtered.length === 0 ? <p className={styles.emptyState}>Ninguna reseña coincide con estos filtros.</p> :
      <div className={styles.list}>{filtered.map((review) => <div key={review.id} className={styles.reviewRow}><div className={styles.reviewMain}><div className={styles.reviewHeader}><span className={styles.customerName}>{review.customerName}</span><span className={styles.stars} aria-label={`${review.rating} de 5 estrellas`}>{stars(review.rating)}</span><span className={styles.bookTitle}>{review.bookTitle}</span></div><p className={styles.reviewText}>{review.body}</p><span className={styles.reviewDate}>{formatDate(review.createdAt)}</span></div>
        <div className={styles.reviewActions}><StatusBadge tone={toneForStatus(STATUS_LABEL[review.status])}>{STATUS_LABEL[review.status]}</StatusBadge><div className={styles.actionButtons}>{review.status !== 'APPROVED' && <button type="button" className={[styles.actionButton, styles.actionButtonApprove].join(' ')} onClick={() => void moderate(review.id, 'APPROVED')}>Aprobar</button>}{review.status !== 'REJECTED' && <button type="button" className={[styles.actionButton, styles.actionButtonReject].join(' ')} onClick={() => void moderate(review.id, 'REJECTED')}>Rechazar</button>}</div><button type="button" className={styles.deleteButton} onClick={() => setPendingDeleteId(review.id)}>Eliminar</button></div></div>)}</div>}
  </div><Dialog open={pendingDeleteId !== null} onClose={() => setPendingDeleteId(null)} title="¿Eliminar esta reseña?" actions={<><Button variant="secondary" onClick={() => setPendingDeleteId(null)}>Cancelar</Button><Button variant="danger" onClick={() => void remove()}>Eliminar</Button></>}>Esta acción no se puede deshacer.</Dialog></AdminLayout>;
}
