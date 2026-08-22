/**
 * Images in the manuscript editor: reading/compressing an uploaded file
 * into a data URL, the exact markup a "figure" gets inserted as, and the
 * small DOM helpers ManuscritoTab uses to read/mutate a selected figure's
 * wrap mode, width and (for "free") position — all direct DOM mutation
 * rather than React state, matching how the rest of the contentEditable
 * region already works (see ManuscritoTab's own doc comment): the figure
 * lives in the live DOM, and `onEditorInput` is called manually afterwards
 * to sync `chapter.html` from it, exactly like execCommand-driven
 * formatting already does.
 *
 * The exact markup produced here is also what
 * `backend/internal/application/manuscripts/exporter.go` parses back out
 * for PDF/EPUB export — keep the two in sync if either changes.
 */

export type ImageWrap = 'inline' | 'center' | 'left' | 'right' | 'free';

export const IMAGE_WRAP_OPTIONS: { value: ImageWrap; label: string }[] = [
  { value: 'inline', label: 'En línea' },
  { value: 'center', label: 'Centrada' },
  { value: 'left', label: 'Costado izquierdo' },
  { value: 'right', label: 'Costado derecho' },
  { value: 'free', label: 'Libre (arrastrable)' },
];

export const IMAGE_CLASS = 'ms-image';
export const IMAGE_SELECTED_CLASS = 'ms-image--selected';
const WRAP_CLASS_PATTERN = /^ms-image--(inline|center|left|right|free)$/;
const MAX_IMAGE_DIMENSION_PX = 1600;
const JPEG_QUALITY = 0.82;
const DEFAULT_WIDTH_PCT = 60;
const DEFAULT_FREE_WIDTH_PCT = 40;

/**
 * Reads a File, downscales it to at most MAX_IMAGE_DIMENSION_PX on its
 * longest side and re-encodes it through an offscreen canvas. A chapter is
 * capped at 8MB of HTML (backend's manuscript.MaxChapterBytes) and images
 * live inline as base64 — an unprocessed phone photo (often 4-12MB) would
 * blow through that budget with a single picture, so this always
 * re-encodes rather than trusting the original file's size.
 */
export function readImageFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo elegido no es una imagen.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('No pudimos leer el archivo.'));
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') {
        reject(new Error('No pudimos leer el archivo.'));
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('No pudimos leer esa imagen.'));
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_DIMENSION_PX / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // PNG/GIF sources keep PNG (transparency); anything else (typically
        // camera JPEGs) is re-encoded as JPEG, which compresses photos far
        // smaller than PNG would.
        const keepPng = file.type === 'image/png' || file.type === 'image/gif';
        resolve(keepPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/** The exact <figure> markup inserted at the caret for a newly-picked image. */
export function figureMarkup(dataUrl: string): string {
  const widthPct = DEFAULT_WIDTH_PCT;
  return (
    `<figure class="${IMAGE_CLASS} ${IMAGE_CLASS}--inline" data-wrap="inline" data-front="true" ` +
    `style="width:${widthPct}%" contenteditable="false">` +
    `<img src="${escapeAttr(dataUrl)}" alt=""></figure>`
  );
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function markSelected(figure: HTMLElement, selected: boolean): void {
  figure.classList.toggle(IMAGE_SELECTED_CLASS, selected);
}

/** Finds the nearest ms-image <figure> ancestor of an event target, if any. */
export function closestImageFigure(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const figure = target.closest(`.${IMAGE_CLASS}`);
  return figure instanceof HTMLElement ? figure : null;
}

export function wrapOf(figure: HTMLElement): ImageWrap {
  const wrap = figure.dataset.wrap;
  return wrap === 'center' || wrap === 'left' || wrap === 'right' || wrap === 'free' ? wrap : 'inline';
}

export function widthPctOf(figure: HTMLElement): number {
  const match = /width:\s*([\d.]+)%/.exec(figure.getAttribute('style') ?? '');
  const value = match ? Number(match[1]) : DEFAULT_WIDTH_PCT;
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_WIDTH_PCT;
}

export function isInFront(figure: HTMLElement): boolean {
  return figure.dataset.front !== 'false';
}

/** Applies a new wrap mode to a figure, resetting position when leaving
 * "free" and picking a sensible default width/position when entering it. */
export function applyWrap(figure: HTMLElement, wrap: ImageWrap): void {
  const classes = figure.className.split(/\s+/).filter((c) => c && !WRAP_CLASS_PATTERN.test(c));
  classes.push(`${IMAGE_CLASS}--${wrap}`);
  figure.className = classes.join(' ');
  figure.dataset.wrap = wrap;

  if (wrap === 'free') {
    const width = Math.min(widthPctOf(figure), 70) || DEFAULT_FREE_WIDTH_PCT;
    setFreePosition(figure, 30, 30, width);
    if (!figure.dataset.front) figure.dataset.front = 'true';
  } else {
    figure.style.left = '';
    figure.style.top = '';
    figure.style.width = `${widthPctOf(figure)}%`;
  }
}

export function applyWidthPct(figure: HTMLElement, widthPct: number): void {
  const clamped = Math.min(100, Math.max(10, Math.round(widthPct)));
  figure.style.width = `${clamped}%`;
}

export function setFront(figure: HTMLElement, front: boolean): void {
  figure.dataset.front = front ? 'true' : 'false';
}

/** left/top are percentages of the editable page's own box — matches how
 * the PDF/EPUB exporters and the editor's own CSS all read position. */
export function setFreePosition(figure: HTMLElement, leftPct: number, topPct: number, widthPct?: number): void {
  const left = clampPct(leftPct);
  const top = clampPct(topPct);
  const width = widthPct !== undefined ? Math.min(100, Math.max(10, Math.round(widthPct))) : widthPctOf(figure);
  figure.style.left = `${left}%`;
  figure.style.top = `${top}%`;
  figure.style.width = `${width}%`;
}

function clampPct(value: number): number {
  return Math.min(95, Math.max(0, Math.round(value * 10) / 10));
}
