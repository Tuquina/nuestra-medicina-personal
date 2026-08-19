/**
 * Cupones (`/admin/cupones`) — one of architecture.md §6's "future
 * extensions". No backend endpoint exists yet, so this is a
 * localStorage-backed CRUD store shaped like the eventual REST resource
 * (`Coupon` mirrors what a `GET/POST/PUT/DELETE /api/v1/admin/coupons`
 * would plausibly return) — swapping in real `fetch` calls later only
 * touches this file, not `CuponesPage.tsx`.
 *
 * Unlike `shared/cms/contentStore.ts` this has no draft/published split
 * — a coupon isn't "page content" with a public/preview distinction, it's
 * a plain admin-managed resource, so writes apply immediately.
 */
import { ADMIN_NOW } from '../adminNow';

export type CouponKind = 'percentage' | 'fixed';
export type CouponComputedStatus = 'Activo' | 'Programado' | 'Vencido' | 'Desactivado';

export interface Coupon {
  id: string;
  code: string;
  kind: CouponKind;
  /** Percentage: 1–100. Fixed: minor units (architecture.md §38 — never a float). */
  value: number;
  startDateISO: string;
  endDateISO: string;
  /** `null` means unlimited. */
  usageLimit: number | null;
  usageCount: number;
  /** `'all'` or a list of book slugs. */
  appliesTo: 'all' | string[];
  /** Manual on/off switch, independent of the date-derived status below. */
  active: boolean;
}

const STORAGE_KEY = 'nmp_admin_coupons_v1';
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToCoupons(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function seedCoupons(): Coupon[] {
  return [
    {
      id: 'c1',
      code: 'BIENVENIDA10',
      kind: 'percentage',
      value: 10,
      startDateISO: '2026-01-01',
      endDateISO: '2026-12-31',
      usageLimit: null,
      usageCount: 34,
      appliesTo: 'all',
      active: true,
    },
    {
      id: 'c2',
      code: 'LANZAMIENTO2000',
      kind: 'fixed',
      value: 200000,
      startDateISO: '2026-08-01',
      endDateISO: '2026-09-30',
      usageLimit: 100,
      usageCount: 12,
      appliesTo: ['el-poder-de-tu-historia'],
      active: true,
    },
    {
      id: 'c3',
      code: 'VERANO2025',
      kind: 'percentage',
      value: 15,
      startDateISO: '2025-01-01',
      endDateISO: '2025-03-01',
      usageLimit: 50,
      usageCount: 50,
      appliesTo: 'all',
      active: true,
    },
  ];
}

function readAll(): Coupon[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Coupon[];
  } catch {
    // fall through to seed
  }
  const seeded = seedCoupons();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function writeAll(coupons: Coupon[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(coupons));
  notify();
}

export function getAllCoupons(): Coupon[] {
  return readAll();
}

export function computeStatus(coupon: Coupon): CouponComputedStatus {
  if (!coupon.active) return 'Desactivado';
  const now = ADMIN_NOW.getTime();
  if (now < new Date(coupon.startDateISO).getTime()) return 'Programado';
  if (now > new Date(coupon.endDateISO).getTime()) return 'Vencido';
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) return 'Vencido';
  return 'Activo';
}

export type NewCoupon = Omit<Coupon, 'id' | 'usageCount'>;

export function createCoupon(input: NewCoupon): Coupon {
  const coupon: Coupon = { ...input, id: `c-${Date.now()}`, usageCount: 0 };
  const all = readAll();
  writeAll([coupon, ...all]);
  return coupon;
}

export function updateCoupon(id: string, patch: Partial<Coupon>): void {
  const all = readAll();
  writeAll(all.map((coupon) => (coupon.id === id ? { ...coupon, ...patch } : coupon)));
}

export function deleteCoupon(id: string): void {
  writeAll(readAll().filter((coupon) => coupon.id !== id));
}
