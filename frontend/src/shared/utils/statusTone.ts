export type StatusTone = 'success' | 'pending' | 'danger' | 'refunded' | 'neutral';

const STATUS_TONE: Record<string, StatusTone> = {
  Aprobado: 'success',
  Pendiente: 'pending',
  Rechazado: 'danger',
  Reembolsado: 'refunded',
  Cancelado: 'danger',
  Vencido: 'danger',
  Publicado: 'success',
  Borrador: 'neutral',
  Activo: 'success',
  Programado: 'pending',
  Vencido: 'danger',
  Desactivado: 'neutral',
  Aprobada: 'success',
  Rechazada: 'danger',
};

/** Maps the known status label strings straight to a `StatusBadge` tone. */
export function toneForStatus(status: string): StatusTone {
  return STATUS_TONE[status] ?? 'neutral';
}
