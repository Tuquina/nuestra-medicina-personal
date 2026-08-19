import type { ReactNode } from 'react';
import styles from './FormField.module.css';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  children: ReactNode;
}

/**
 * A label + control pair with the admin form's consistent spacing.
 * Compose with the exported `styles` (`.control`, `.row2`/`.row3`,
 * `.stack`) for the input itself — kept as plain CSS classes rather than
 * wrapping every input type in its own component, since the admin forms
 * mix native `<input>`/`<select>`/`<textarea>` freely.
 */
export function FormField({ label, htmlFor, children }: FormFieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor} className={styles.label}>
        {label}
      </label>
      {children}
    </div>
  );
}
