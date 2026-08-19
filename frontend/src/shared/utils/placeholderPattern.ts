/**
 * The mockups stand in for real photography with a diagonal-stripe swatch
 * (a `repeating-linear-gradient` between an accent tone and a neutral
 * base) plus a small caption pill describing what the real photo should
 * be. This reproduces that pattern so it can be swapped for a real `<img>`
 * later without touching layout.
 */
export function stripedPlaceholder(
  accent: string,
  base: string = 'var(--color-placeholder-base)',
): string {
  return `repeating-linear-gradient(135deg, ${accent} 0px, ${accent} 16px, ${base} 16px, ${base} 32px)`;
}
