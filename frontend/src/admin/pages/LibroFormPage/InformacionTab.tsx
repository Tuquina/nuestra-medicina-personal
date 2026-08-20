import { FormField } from '../../../shared/components/FormField/FormField';
import f from '../../../shared/components/FormField/FormField.module.css';
import { STATUS_OPTIONS, type LibroFormState } from './libroFormTypes';

interface InformacionTabProps {
  form: LibroFormState;
  onChange: <K extends keyof LibroFormState>(key: K, value: LibroFormState[K]) => void;
}

export function InformacionTab({ form, onChange }: InformacionTabProps) {
  return (
    <div className={f.stack}>
      <FormField label="Título" htmlFor="title">
        <input
          id="title"
          type="text"
          className={f.control}
          value={form.title}
          onChange={(e) => onChange('title', e.target.value)}
        />
      </FormField>

      <FormField label="Subtítulo" htmlFor="subtitle">
        <input
          id="subtitle"
          type="text"
          className={f.control}
          value={form.subtitle}
          onChange={(e) => onChange('subtitle', e.target.value)}
        />
      </FormField>

      <div className={[f.row, f.row2].join(' ')}>
        <FormField label="Autor/a" htmlFor="author">
          <input
            id="author"
            type="text"
            className={f.control}
            value={form.authorName}
            onChange={(e) => onChange('authorName', e.target.value)}
          />
        </FormField>
        <FormField label="Slug" htmlFor="slug">
          <input
            id="slug"
            type="text"
            className={[f.control, f.mono].join(' ')}
            value={form.slug}
            onChange={(e) => onChange('slug', e.target.value)}
          />
        </FormField>
      </div>

      <div className={[f.row, f.row2].join(' ')}>
        <FormField label="Colección" htmlFor="category">
          <input
            id="category"
            type="text"
            className={f.control}
            value={form.category}
            onChange={(e) => onChange('category', e.target.value)}
          />
        </FormField>
        <FormField label="Estilo visual" htmlFor="variant">
          <select
            id="variant"
            className={f.control}
            value={form.variant}
            onChange={(e) => onChange('variant', e.target.value as LibroFormState['variant'])}
          >
            <option value="blue">Azul</option>
            <option value="gold">Dorado</option>
          </select>
        </FormField>
      </div>

      <FormField label="Descripción breve" htmlFor="shortDescription">
        <textarea
          id="shortDescription"
          rows={3}
          className={f.control}
          value={form.shortDescription}
          onChange={(e) => onChange('shortDescription', e.target.value)}
        />
      </FormField>

      <div className={[f.row, f.row3].join(' ')}>
        <FormField label="Precio" htmlFor="price">
          <input
            id="price"
            type="text"
            inputMode="decimal"
            className={f.control}
            value={form.priceDisplay}
            onChange={(e) => onChange('priceDisplay', e.target.value)}
          />
        </FormField>
        <FormField label="Moneda" htmlFor="currency">
          <select
            id="currency"
            className={f.control}
            value={form.currency}
            onChange={(e) => onChange('currency', e.target.value)}
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </FormField>
        <FormField label="Estado" htmlFor="status">
          <select
            id="status"
            className={f.control}
            value={form.status}
            onChange={(e) => onChange('status', e.target.value as LibroFormState['status'])}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className={[f.row, f.row2].join(' ')}>
        <FormField label="ISBN" htmlFor="isbn">
          <input
            id="isbn"
            type="text"
            placeholder="978-0-00-000000-0"
            className={f.control}
            value={form.isbn}
            onChange={(e) => onChange('isbn', e.target.value)}
          />
        </FormField>
        <FormField label="Formato" htmlFor="format">
          <input
            id="format"
            type="text"
            className={f.control}
            value={form.format}
            onChange={(e) => onChange('format', e.target.value)}
          />
        </FormField>
      </div>

      <div className={[f.row, f.row2].join(' ')}>
        <FormField label="Fecha exacta" htmlFor="publicationDate">
          <input
            id="publicationDate"
            type="date"
            className={f.control}
            value={form.publicationDate}
            onChange={(e) => onChange('publicationDate', e.target.value)}
          />
        </FormField>
        <FormField label="Fecha visible" htmlFor="pubDateLabel">
          <input
            id="pubDateLabel"
            type="text"
            className={f.control}
            value={form.publicationDateLabel}
            onChange={(e) => onChange('publicationDateLabel', e.target.value)}
          />
        </FormField>
      </div>
    </div>
  );
}
