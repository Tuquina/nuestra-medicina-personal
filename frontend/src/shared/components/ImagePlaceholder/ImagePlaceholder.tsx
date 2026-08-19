import type { CSSProperties } from 'react';
import { stripedPlaceholder } from '../../utils/placeholderPattern';
import styles from './ImagePlaceholder.module.css';

interface ImagePlaceholderProps {
  /** Accent stripe color (an `oklch(...)` string, may include alpha). */
  accent: string;
  /** Second stripe color. Defaults to the neutral placeholder base token. */
  base?: string;
  /**
   * Caption pill describing the real photo this will become. Omit for
   * small thumbnails where the mockup doesn't show one (e.g. the
   * Biblioteca cover thumbnails) — pass `alt` instead so it's still
   * accessible.
   */
  caption?: string;
  /** Accessible label when there's no visible caption. Defaults to `caption`. */
  alt?: string;
  aspectRatio?: string;
  borderRadius?: string;
  className?: string;
}

/**
 * Stand-in for real photography (architecture.md §1.2 calls for a
 * photo-led home page, but no final asset selection has happened yet).
 * Swap for a real `<img>`/`<picture>` once photography is chosen — the
 * `caption` prop documents what each slot is meant to hold.
 */
export function ImagePlaceholder({
  accent,
  base,
  caption,
  alt,
  aspectRatio,
  borderRadius,
  className,
}: ImagePlaceholderProps) {
  // Only set aspect-ratio/border-radius inline when explicitly requested —
  // otherwise leave them to the caller's CSS class (e.g. a grid tile that
  // needs its ratio to change at a breakpoint; inline styles would win
  // over the class and defeat that).
  const style: CSSProperties = {
    ...(aspectRatio ? { aspectRatio } : null),
    ...(borderRadius ? { borderRadius } : null),
    background: stripedPlaceholder(accent, base),
  };

  return (
    <div
      className={[styles.placeholder, className].filter(Boolean).join(' ')}
      style={style}
      role="img"
      aria-label={alt ?? caption ?? ''}
    >
      {caption && (
        <span className={styles.caption} aria-hidden="true">
          {caption}
        </span>
      )}
    </div>
  );
}
