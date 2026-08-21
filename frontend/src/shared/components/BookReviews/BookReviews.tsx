import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { bookReviewsUrl } from '../../config/api';
import { apiRequest, ApiError } from '../../api/client';
import { useAuth } from '../../auth/useAuth';
import styles from './BookReviews.module.css';

interface ReviewResponse {
  id: string;
  customerName: string;
  rating: number;
  body: string;
  createdAt: string;
}

interface ReviewListResponse {
  items: ReviewResponse[];
  total: number;
}

const MAX_BODY_LENGTH = 4000;

function Stars({ rating }: { rating: number }) {
  return (
    <span className={styles.stars} aria-label={`${rating} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <span key={value} aria-hidden="true" className={value <= rating ? styles.starFilled : styles.starEmpty}>
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * Public reviews block for `/libros/:slug` — lists approved reviews and, for
 * signed-in users, a submission form. The purchase requirement is enforced
 * server-side (`GET/POST /api/v1/books/{slug}/reviews`); this component
 * never pre-checks the library, it just reacts to `REVIEW_PURCHASE_REQUIRED`.
 */
export function BookReviews({ bookSlug }: { bookSlug: string }) {
  const auth = useAuth();
  const [reviews, setReviews] = useState<ReviewResponse[] | null>(null);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<ReviewListResponse>(bookReviewsUrl(bookSlug), { signal: controller.signal })
      .then((response) => setReviews(response.items))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setReviews([]);
      });
    return () => controller.abort();
  }, [bookSlug]);

  const average =
    reviews && reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiRequest(bookReviewsUrl(bookSlug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, body }),
      });
      setSubmitted(true);
      setBody('');
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'REVIEW_PURCHASE_REQUIRED') {
        setSubmitError('Necesitás haber comprado este libro para dejar una reseña.');
      } else if (error instanceof ApiError && error.code === 'REVIEW_ALREADY_EXISTS') {
        setSubmitError('Ya dejaste una reseña para este libro.');
      } else if (error instanceof ApiError && error.code === 'REVIEW_VALIDATION_FAILED') {
        setSubmitError('Revisá el puntaje y el texto de tu reseña.');
      } else {
        setSubmitError('No pudimos enviar tu reseña. Intentá nuevamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Reseñas de lectores</h2>

      {average !== null && (
        <p className={styles.summary}>
          <Stars rating={Math.round(average)} />
          <span className={styles.summaryText}>
            {average.toFixed(1)} de 5 · {reviews?.length} reseña{reviews?.length === 1 ? '' : 's'}
          </span>
        </p>
      )}

      {reviews === null ? (
        <p className={styles.emptyState}>Cargando reseñas…</p>
      ) : reviews.length === 0 ? (
        <p className={styles.emptyState}>Todavía no hay reseñas para este libro.</p>
      ) : (
        <ul className={styles.list}>
          {reviews.map((review) => (
            <li key={review.id} className={styles.item}>
              <div className={styles.itemHeader}>
                <Stars rating={review.rating} />
                <span className={styles.customerName}>{review.customerName}</span>
              </div>
              <p className={styles.body}>{review.body}</p>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.formCard}>
        {auth.status !== 'authenticated' ? (
          <p className={styles.ctaText}>
            <Link to="/login" className={styles.ctaLink}>
              Iniciá sesión
            </Link>{' '}
            para dejar tu reseña.
          </p>
        ) : submitted ? (
          <p className={styles.confirmation}>Gracias, tu reseña quedó en revisión.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className={styles.formLabel} htmlFor="review-rating">
              Tu puntaje
            </label>
            <select
              id="review-rating"
              className={styles.ratingSelect}
              value={rating}
              onChange={(event) => setRating(Number(event.target.value))}
              disabled={submitting}
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} de 5
                </option>
              ))}
            </select>

            <label className={styles.formLabel} htmlFor="review-body">
              Tu reseña
            </label>
            <textarea
              id="review-body"
              className={styles.textarea}
              value={body}
              maxLength={MAX_BODY_LENGTH}
              required
              rows={4}
              onChange={(event) => setBody(event.target.value)}
              disabled={submitting}
            />
            <p className={styles.charCount}>
              {body.length} / {MAX_BODY_LENGTH}
            </p>

            {submitError && (
              <p className={styles.errorText} role="alert">
                {submitError}
              </p>
            )}

            <button type="submit" className={styles.submit} disabled={submitting || body.trim().length === 0}>
              {submitting ? 'Enviando…' : 'Enviar reseña'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
