import type { MouseEvent } from 'react';
import type { Section } from '../../../shared/cms/types';
import { HomeSectionContent } from '../../../public-store/pages/HomePage/HomeSections';
import { SECTION_SCHEMAS } from './sectionSchemas';
import styles from './PageBuilderPage.module.css';

export type BuilderView = 'desktop' | 'tablet' | 'mobile';

const CANVAS_WIDTH: Record<BuilderView, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '390px',
};

interface CanvasProps {
  sections: Section[];
  selectedId: string | null;
  view: BuilderView;
  onSelect: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleHide: (id: string) => void;
  onRemove: (id: string) => void;
}

/**
 * The center editing surface — real Home section components, in publish
 * order, each wrapped with a hover/selected toolbar. This is a genuine
 * preview (not an abstract colored box): what an admin sees here is what
 * visitors see once the page is published, so "cómo se va a ver" is
 * answered directly instead of by imagining it from a label.
 */
export function Canvas({ sections, selectedId, view, onSelect, onMoveUp, onMoveDown, onDuplicate, onToggleHide, onRemove }: CanvasProps) {
  return (
    <main className={styles.canvasArea}>
      <div className={styles.canvas} style={{ width: CANVAS_WIDTH[view] }}>
        {sections.length === 0 && (
          <p className={styles.canvasEmpty}>
            Esta página no tiene bloques todavía. Agregá uno desde la izquierda.
          </p>
        )}

        {sections.map((section, index) => {
          const isSelected = section.id === selectedId;
          const schema = SECTION_SCHEMAS[section.type];
          const stop = (event: MouseEvent, action: () => void) => {
            event.stopPropagation();
            action();
          };

          return (
            <div
              key={section.id}
              className={[styles.block, isSelected ? styles.blockSelected : '', section.hidden ? styles.blockFaded : ''].join(' ')}
              onClick={() => onSelect(section.id)}
            >
              <div className={styles.blockRendered}>
                <HomeSectionContent section={section} />
              </div>

              <div className={[styles.blockToolbar, isSelected ? styles.blockToolbarVisible : ''].join(' ')}>
                {schema && <span className={styles.blockTypeTag}>{schema.label}</span>}
                <button
                  type="button"
                  className={styles.toolbarIconButton}
                  title="Mover arriba"
                  aria-label="Mover arriba"
                  disabled={index === 0}
                  onClick={(e) => stop(e, () => onMoveUp(section.id))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.toolbarIconButton}
                  title="Mover abajo"
                  aria-label="Mover abajo"
                  disabled={index === sections.length - 1}
                  onClick={(e) => stop(e, () => onMoveDown(section.id))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={styles.toolbarIconButton}
                  title="Duplicar bloque"
                  aria-label="Duplicar bloque"
                  onClick={(e) => stop(e, () => onDuplicate(section.id))}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className={styles.toolbarIconButton}
                  title={section.hidden ? 'Mostrar bloque' : 'Ocultar bloque'}
                  aria-label={section.hidden ? 'Mostrar bloque' : 'Ocultar bloque'}
                  onClick={(e) => stop(e, () => onToggleHide(section.id))}
                >
                  {section.hidden ? '◌' : '●'}
                </button>
                <button
                  type="button"
                  className={[styles.toolbarIconButton, styles.toolbarIconButtonDanger].join(' ')}
                  title="Eliminar bloque"
                  aria-label="Eliminar bloque"
                  onClick={(e) => stop(e, () => onRemove(section.id))}
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
