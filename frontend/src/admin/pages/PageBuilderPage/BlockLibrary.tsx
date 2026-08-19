import { CONTENT_BLOCKS, LAYOUT_BLOCKS, MARKETING_BLOCKS, COMMERCE_BLOCKS } from './pageBuilderData';
import styles from './PageBuilderPage.module.css';

interface BlockLibraryProps {
  onAdd: (type: string) => void;
}

const GROUPS: { title: string; items: string[] }[] = [
  { title: 'Contenido', items: CONTENT_BLOCKS },
  { title: 'Diseño', items: LAYOUT_BLOCKS },
  { title: 'Marketing', items: MARKETING_BLOCKS },
  { title: 'Comercio', items: COMMERCE_BLOCKS },
];

/** The left palette of addable block types (architecture.md §11). */
export function BlockLibrary({ onAdd }: BlockLibraryProps) {
  return (
    <aside className={styles.library}>
      {GROUPS.map((group) => (
        <div key={group.title}>
          <p className={styles.libraryGroupTitle}>{group.title}</p>
          <div className={styles.libraryGroup}>
            {group.items.map((label) => (
              <button key={label} type="button" className={styles.libraryItem} onClick={() => onAdd(label)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}
