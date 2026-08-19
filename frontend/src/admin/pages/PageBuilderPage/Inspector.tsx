import type { Section } from '../../../shared/cms/types';
import { SECTION_SCHEMAS, type FieldDef } from './sectionSchemas';
import styles from './PageBuilderPage.module.css';

interface InspectorProps {
  section: Section | undefined;
  onChangeProp: (key: string, value: unknown) => void;
  onToggleHidden: () => void;
}

function Field({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (value: unknown) => void }) {
  if (field.kind === 'note') {
    return <p className={styles.fieldNote}>{field.hint}</p>;
  }

  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={`field-${field.key}`}>
        {field.label}
      </label>

      {field.kind === 'text' && (
        <input
          id={`field-${field.key}`}
          type="text"
          className={styles.textInput}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.kind === 'textarea' && (
        <textarea
          id={`field-${field.key}`}
          className={styles.textarea}
          rows={3}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.kind === 'lines' && (
        <textarea
          id={`field-${field.key}`}
          className={styles.textarea}
          rows={5}
          value={Array.isArray(value) ? (value as string[]).join('\n') : ''}
          onChange={(e) => onChange(e.target.value.split('\n'))}
        />
      )}

      {field.kind === 'select' && (
        <select
          id={`field-${field.key}`}
          className={styles.select}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}

      {field.kind === 'checkbox' && (
        <label className={styles.visibilityLabel}>
          <input
            id={`field-${field.key}`}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          {field.label}
        </label>
      )}
    </div>
  );
}

/**
 * The selected block's real content fields, driven by `sectionSchemas.ts`
 * — every field here edits an actual prop the public Home page renders,
 * so there's no gap between "what you configure" and "what visitors see".
 */
export function Inspector({ section, onChangeProp, onToggleHidden }: InspectorProps) {
  if (!section) {
    return (
      <aside className={styles.inspector}>
        <p className={styles.emptyInspector}>Seleccioná un bloque en el lienzo para editar su contenido.</p>
      </aside>
    );
  }

  const schema = SECTION_SCHEMAS[section.type];

  return (
    <aside className={styles.inspector}>
      <h2 className={styles.inspectorTitle}>{schema?.label ?? section.type}</h2>
      <p className={styles.inspectorSubtitle}>Bloque seleccionado</p>

      <label className={[styles.visibilityLabel, styles.visibilityToggleTop].join(' ')}>
        <input type="checkbox" checked={!section.hidden} onChange={onToggleHidden} />
        Visible en el sitio
      </label>

      {schema && schema.fields.length > 0 && (
        <>
          <p className={[styles.inspectorSectionTitle, styles.inspectorSectionTitleSpaced].join(' ')}>Contenido</p>
          {schema.fields.map((field) => (
            <Field
              key={field.key}
              field={field}
              value={(section.props as Record<string, unknown>)[field.key]}
              onChange={(value) => onChangeProp(field.key, value)}
            />
          ))}
        </>
      )}

      {schema && schema.fields.length === 0 && (
        <p className={styles.fieldNote}>Este bloque no tiene opciones de contenido.</p>
      )}
    </aside>
  );
}
