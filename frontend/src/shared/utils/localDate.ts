/**
 * Calendar helpers that work in the visitor's local time zone. Keys are
 * `YYYY-MM-DD` strings so they sort chronologically and survive JSON.
 * (`toISOString()` is avoided on purpose: it is UTC, so late-evening
 * writing in Argentina would land on the next day.)
 */

export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** "viernes 13 de noviembre" */
export function formatLongDate(key: string): string {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(dateFromKey(key));
}

/** "13 nov. 2026" */
export function formatShortDate(key: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(dateFromKey(key));
}

/** Days since the Unix epoch for a local date — a stable "day number" to rotate daily content. */
export function dayNumber(key: string): number {
  const date = dateFromKey(key);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export interface WeekRange {
  /** Monday of the week, as a date key. */
  startKey: string;
  /** "Semana del 9 al 15 de noviembre" */
  label: string;
}

/** The Monday–Sunday week containing `date`. */
export function weekRangeOf(date: Date): WeekRange {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offsetFromMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offsetFromMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const month = new Intl.DateTimeFormat('es-AR', { month: 'long' });
  const label =
    monday.getMonth() === sunday.getMonth()
      ? `Semana del ${monday.getDate()} al ${sunday.getDate()} de ${month.format(sunday)}`
      : `Semana del ${monday.getDate()} de ${month.format(monday)} al ${sunday.getDate()} de ${month.format(sunday)}`;

  return { startKey: localDateKey(monday), label };
}
