import type { ReportingRange, SaleDisplayStatus } from './types';

export const PERIOD_LABELS: Record<ReportingRange, string> = {
  '7d': 'últimos 7 días',
  '30d': 'últimos 30 días',
  year: 'este año',
  all: 'todo el período',
};

export const SALE_STATUS_LABELS: Record<SaleDisplayStatus, string> = {
  APPROVED: 'Aprobado',
  PENDING: 'Pendiente',
  REJECTED: 'Rechazado',
  REFUNDED: 'Reembolsado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Vencido',
};

export function formatAdminDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTrendLabel(value: string, range: ReportingRange): string {
  const date = new Date(value);
  if (range === 'year') return date.toLocaleDateString('es-AR', { month: 'short' });
  if (range === 'all') return String(date.getUTCFullYear());
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: range === '30d' ? 'short' : undefined });
}
