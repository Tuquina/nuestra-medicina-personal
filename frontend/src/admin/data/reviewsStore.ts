/**
 * Reseñas (`/admin/resenas`) — another of architecture.md §6's "future
 * extensions". No backend endpoint exists yet, so this is a
 * localStorage-backed CRUD store shaped like the eventual REST resource
 * (`Review` mirrors what a `GET /api/v1/admin/reviews` +
 * `PUT .../:id` moderation endpoint would plausibly return) — swapping
 * in real `fetch` calls later only touches this file, not
 * `ResenasPage.tsx`.
 *
 * Unlike Cupones, admins don't *create* reviews here — they come from
 * customers on the public site (not built yet) — this only moderates
 * (approve/reject) and removes them.
 */

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Review {
  id: string;
  bookSlug: string;
  customerName: string;
  /** 1–5. */
  rating: number;
  text: string;
  createdAtISO: string;
  status: ReviewStatus;
}

const STORAGE_KEY = 'nmp_admin_reviews_v1';
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToReviews(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function seedReviews(): Review[] {
  return [
    {
      id: 'r1',
      bookSlug: 'el-poder-de-tu-historia',
      customerName: 'María Álvarez',
      rating: 5,
      text: 'Me ayudó a poner en palabras cosas que hacía años no me animaba a escribir. Lo recomiendo mucho.',
      createdAtISO: '2026-08-15',
      status: 'approved',
    },
    {
      id: 'r2',
      bookSlug: 'el-poder-de-tu-historia',
      customerName: 'Nicolás Ferreyra',
      rating: 4,
      text: 'Muy buen libro para empezar a escribir sobre uno mismo. Algunos capítulos son más útiles que otros.',
      createdAtISO: '2026-08-11',
      status: 'pending',
    },
    {
      id: 'r3',
      bookSlug: 'la-escritura-terapeutica-entra-a-la-escuela',
      customerName: 'Sofía Rivas',
      rating: 5,
      text: 'Lo usé con mis alumnos de secundario y funcionó mejor de lo que esperaba. Las consignas son muy claras.',
      createdAtISO: '2026-08-05',
      status: 'approved',
    },
    {
      id: 'r4',
      bookSlug: 'el-poder-de-tu-historia',
      customerName: 'Anónimo',
      rating: 1,
      text: 'Esto es spam, comprá seguidores en mi-sitio-falso.com',
      createdAtISO: '2026-08-02',
      status: 'pending',
    },
    {
      id: 'r5',
      bookSlug: 'la-escritura-terapeutica-entra-a-la-escuela',
      customerName: 'Martín Ruiz',
      rating: 3,
      text: 'Está bien pero esperaba más actividades listas para llevar directamente al aula.',
      createdAtISO: '2026-07-28',
      status: 'rejected',
    },
  ];
}

function readAll(): Review[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Review[];
  } catch {
    // fall through to seed
  }
  const seeded = seedReviews();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function writeAll(reviews: Review[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
  notify();
}

export function getAllReviews(): Review[] {
  return readAll();
}

export function setReviewStatus(id: string, status: ReviewStatus): void {
  writeAll(readAll().map((review) => (review.id === id ? { ...review, status } : review)));
}

export function deleteReview(id: string): void {
  writeAll(readAll().filter((review) => review.id !== id));
}
