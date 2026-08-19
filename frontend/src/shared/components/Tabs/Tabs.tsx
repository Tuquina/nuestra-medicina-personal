import styles from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
}

/** The underline-style tab row used by the book editor and (later) other admin forms. */
export function Tabs({ tabs, activeId, onChange }: TabsProps) {
  return (
    <div className={styles.tabs} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === activeId}
          onClick={() => onChange(tab.id)}
          className={[styles.tab, tab.id === activeId ? styles.tabActive : ''].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
