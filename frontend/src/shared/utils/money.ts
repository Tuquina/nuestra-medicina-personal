/**
 * Formats a price stored in minor units (centavos) as ARS currency.
 *
 * Mirrors the backend convention in architecture.md §38 ("never use
 * float for money — minor units"); every price this formats comes from
 * the API already in that shape.
 */
export function formatPrice(minorUnits: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(minorUnits / 100);
}
