import { MM_TO_PX, PAGE_MARGIN_MM, pageContentHeightPx, type PageSize } from './pageSizes';
import styles from './ManuscritoTab.module.css';

interface PageBreakOverlayProps {
  pageSize: PageSize;
  contentHeightPx: number;
}

/**
 * Draws where the manuscript would actually break across physical pages
 * of `pageSize`, over the single continuous `contentEditable` region.
 *
 * This does **not** split the DOM into separate page boxes — a real
 * paginated editor (Word/Google Docs style) reflows content across fixed
 * page boundaries, which needs a layout engine well beyond what
 * `contentEditable` gives you for free. What this does instead: the
 * editable area's width is set to match the chosen paper's content
 * width (so line wrapping is accurate), and this overlay marks, live,
 * where each page would end — updated from the editor's real scroll
 * height via a `ResizeObserver` in `ManuscritoTab`. That's enough to
 * answer "how many pages is this / where do they break" while typing,
 * without building a typesetting engine.
 */
export function PageBreakOverlay({ pageSize, contentHeightPx }: PageBreakOverlayProps) {
  const contentPerPage = pageContentHeightPx(pageSize);
  const pageCount = Math.max(1, Math.ceil(contentHeightPx / contentPerPage));
  const breaks = Array.from({ length: pageCount - 1 }, (_, i) => i + 1);

  return (
    <div className={styles.pageBreakLayer} aria-hidden="true">
      {breaks.map((pageNumber) => (
        <div
          key={pageNumber}
          className={styles.pageBreakBand}
          style={{
            top: `calc(${PAGE_MARGIN_MM}mm + ${pageNumber * contentPerPage}px)`,
            height: `${PAGE_MARGIN_MM * 2 * MM_TO_PX}px`,
          }}
        >
          <span className={styles.pageBreakLabel}>
            Fin de página {pageNumber} · Inicio de página {pageNumber + 1}
          </span>
        </div>
      ))}
    </div>
  );
}
