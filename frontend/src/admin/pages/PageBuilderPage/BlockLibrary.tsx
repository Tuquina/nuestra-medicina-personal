import { ADDABLE_BLOCK_TYPES, SECTION_SCHEMAS } from './sectionSchemas';
import styles from './PageBuilderPage.module.css';

interface BlockLibraryProps {
  onAdd: (type: string) => void;
}

const BLOCK_HINTS: Record<string, string> = {
  title: 'Un título grande y centrado.',
  text: 'Un párrafo de texto libre.',
  image: 'Una imagen con descripción.',
  quote: 'Una frase destacada en cursiva.',
  divider: 'Una línea fina para separar secciones.',
  spacer: 'Espacio en blanco entre bloques.',
};

/**
 * The left palette — the free-standing blocks an admin can drop into the
 * page. The 8 structural sections (Hero, Galería, etc.) already exist on
 * every Home page and aren't "added" here; they're edited in place on the
 * canvas, which is what keeps this list short and unambiguous.
 */
export function BlockLibrary({ onAdd }: BlockLibraryProps) {
  return (
    <aside className={styles.library}>
      <div className={styles.usageHint}>
        Hacé clic en un bloque del lienzo para editarlo a la derecha. Usá{' '}
        <strong>↑ ↓</strong> para reordenar, <strong>⧉</strong> para duplicar,{' '}
        <strong>●</strong> para ocultar y <strong>✕</strong> para eliminar.
      </div>

      <p className={styles.libraryGroupTitle}>Agregar bloque</p>
      <div className={styles.libraryGroup}>
        {ADDABLE_BLOCK_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={styles.libraryItem}
            title={BLOCK_HINTS[type]}
            onClick={() => onAdd(type)}
          >
            {SECTION_SCHEMAS[type]?.label ?? type}
          </button>
        ))}
      </div>
    </aside>
  );
}
