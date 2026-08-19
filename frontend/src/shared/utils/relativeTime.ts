/**
 * "Hace N día(s)" relative-time label, day-granularity only (matches the
 * admin mockups — no hours/minutes shown anywhere in them).
 */
export function relativeDaysEs(dateISO: string, now: Date): string {
  const diffDays = Math.round((now.getTime() - new Date(dateISO).getTime()) / 86_400_000);
  if (diffDays <= 0) return 'Hoy';
  if (diffDays === 1) return 'Hace 1 día';
  return `Hace ${diffDays} días`;
}
