import { FormField } from '../../../shared/components/FormField/FormField';
import f from '../../../shared/components/FormField/FormField.module.css';
import type { LibroFormState } from './libroFormTypes';
import styles from './SeoTab.module.css';

interface SeoTabProps {
  form: LibroFormState;
  onChange: <K extends keyof LibroFormState>(key: K, value: LibroFormState[K]) => void;
}

export function SeoTab({ form, onChange }: SeoTabProps) {
  const url = `nuestramedicinapersonal.com/libros/${form.slug}`;

  return (
    <div className={f.stack}>
      <FormField label="Título SEO" htmlFor="seoTitle">
        <input
          id="seoTitle"
          type="text"
          className={f.control}
          value={form.seoTitle}
          onChange={(e) => onChange('seoTitle', e.target.value)}
        />
      </FormField>

      <FormField label="Descripción SEO" htmlFor="seoDescription">
        <textarea
          id="seoDescription"
          rows={2}
          className={f.control}
          value={form.seoDescription}
          onChange={(e) => onChange('seoDescription', e.target.value)}
        />
      </FormField>

      <FormField label="URL" htmlFor="seoUrl">
        <input id="seoUrl" type="text" disabled value={url} className={[f.control, f.mono].join(' ')} />
      </FormField>

      <div className={styles.checkboxRow}>
        <input
          type="checkbox"
          id="indexable"
          checked={form.seoIndexable}
          onChange={(e) => onChange('seoIndexable', e.target.checked)}
        />
        <label htmlFor="indexable" className={styles.checkboxLabel}>
          Permitir indexación en buscadores
        </label>
      </div>

      <div className={styles.previewCard}>
        <p className={styles.previewBreadcrumb}>nuestramedicinapersonal.com › libros › {form.slug}</p>
        <p className={styles.previewTitle}>{form.seoTitle || `${form.title} — Nuestra Medicina Personal`}</p>
        <p className={styles.previewDescription}>{form.seoDescription || form.shortDescription}</p>
      </div>
    </div>
  );
}
