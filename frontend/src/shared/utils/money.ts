/**
 * Formats a price stored in minor units (centavos) as ARS currency.
 *
 * Mirrors the backend convention in architecture.md §38 ("never use
 * float for money — minor units") even though this is frontend mock data
 * today; when the real API lands it will already speak this shape.
 */
export function formatPrice(minorUnits: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minorUnits / 100);
}
