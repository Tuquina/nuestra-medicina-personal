/**
 * Physical page sizes for the manuscript editor's "print preview" mode.
 * Millimeters are used directly as CSS `mm` units rather than converted
 * to px by hand — the browser already does that conversion exactly
 * (CSS defines 1in = 96px = 25.4mm as a fixed reference, independent of
 * the real screen's DPI), so `mm` values here render pixel-identical to
 * what `MM_TO_PX` computes for the JS-side page-break math below.
 */
export interface PageSize {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

export const PAGE_SIZES: PageSize[] = [
  { id: 'a4', label: 'A4 (210 × 297 mm)', widthMm: 210, heightMm: 297 },
  { id: 'carta', label: 'Carta / Letter (216 × 279 mm)', widthMm: 215.9, heightMm: 279.4 },
  { id: 'oficio', label: 'Oficio (216 × 330 mm)', widthMm: 215.9, heightMm: 330 },
  { id: 'legal', label: 'Legal (216 × 356 mm)', widthMm: 215.9, heightMm: 355.6 },
  { id: 'pocket', label: 'Libro de bolsillo (127 × 203 mm)', widthMm: 127, heightMm: 203 },
];

export const DEFAULT_PAGE_SIZE_ID = 'a4';

/** A standard 1-inch manuscript margin on every side. */
export const PAGE_MARGIN_MM = 25.4;

/** CSS's fixed px-per-mm reference (1in = 96px = 25.4mm) — matches how the browser renders `mm` units exactly. */
export const MM_TO_PX = 96 / 25.4;

export function pageContentHeightPx(size: PageSize): number {
  return (size.heightMm - PAGE_MARGIN_MM * 2) * MM_TO_PX;
}

export function findPageSize(id: string): PageSize {
  return PAGE_SIZES.find((size) => size.id === id) ?? PAGE_SIZES[0];
}
