import type { MouseEvent } from 'react';
import { BG_STYLES, BG_TEXT_COLOR, WIDTH_MAX, type PageBlock } from './pageBuilderData';
import styles from './PageBuilderPage.module.css';

export type BuilderView = 'desktop' | 'tablet' | 'mobile';

const CANVAS_WIDTH: Record<BuilderView, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '390px',
};

interface CanvasProps {
  blocks: PageBlock[];
  selectedId: string | null;
  view: BuilderView;
  onSelect: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleHide: (id: string) => void;
  onRemove: (id: string) => void;
}

function isDeviceHidden(block: PageBlock, view: BuilderView): boolean {
  if (view === 'mobile') return !block.vis.m;
  if (view === 'tablet') return !block.vis.t;
  return !block.vis.d;
}

/** The center editing surface: block previews in publish order, with a per-block hover/selected toolbar. */
export function Canvas({ blocks, selectedId, view, onSelect, onMoveUp, onMoveDown, onDuplicate, onToggleHide, onRemove }: CanvasProps) {
  return (
    <main className={styles.canvasArea}>
      <div className={styles.canvas} style={{ width: CANVAS_WIDTH[view] }}>
        {blocks.map((block) => {
          const isSelected = block.id === selectedId;
          const faded = block.hidden || isDeviceHidden(block, view);
          const stop = (event: MouseEvent, action: () => void) => {
            event.stopPropagation();
            action();
          };

          return (
            <div
              key={block.id}
              className={[styles.block, isSelected ? styles.blockSelected : '', faded ? styles.blockFaded : ''].join(
                ' ',
              )}
              onClick={() => onSelect(block.id)}
            >
              <div
                className={styles.blockPreview}
                style={{ background: BG_STYLES[block.bg], maxWidth: WIDTH_MAX[block.width] }}
              >
                <span className={styles.blockLabel} style={{ color: BG_TEXT_COLOR[block.bg] }}>
                  {block.label}
                </span>
              </div>
              <div className={[styles.blockToolbar, isSelected ? styles.blockToolbarVisible : ''].join(' ')}>
                <button
                  type="button"
                  className={styles.toolbarIconButton}
                  onClick={(e) => stop(e, () => onMoveUp(block.id))}
                  aria-label="Mover arriba"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.toolbarIconButton}
                  onClick={(e) => stop(e, () => onMoveDown(block.id))}
                  aria-label="Mover abajo"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={styles.toolbarIconButton}
                  onClick={(e) => stop(e, () => onDuplicate(block.id))}
                  aria-label="Duplicar"
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className={styles.toolbarIconButton}
                  onClick={(e) => stop(e, () => onToggleHide(block.id))}
                  aria-label={block.hidden ? 'Mostrar bloque' : 'Ocultar bloque'}
                >
                  {block.hidden ? '◌' : '●'}
                </button>
                <button
                  type="button"
                  className={[styles.toolbarIconButton, styles.toolbarIconButtonDanger].join(' ')}
                  onClick={(e) => stop(e, () => onRemove(block.id))}
                  aria-label="Eliminar bloque"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
