import styles from './ChoiceChips.module.css';

interface ChoiceChipsProps<T extends string> {
  /** Accessible name for the group, e.g. "¿Cómo llegás hoy?". */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** When true, clicking the selected chip clears the selection. */
  allowClear?: boolean;
}

/** A row of pill toggles where at most one option is selected. */
export function ChoiceChips<T extends string>({ label, options, value, onChange, allowClear = false }: ChoiceChipsProps<T>) {
  return (
    <div className={styles.group} role="group" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={`${styles.chip} ${selected ? styles.selected : ''}`}
            aria-pressed={selected}
            onClick={() => onChange(selected && allowClear ? null : option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
