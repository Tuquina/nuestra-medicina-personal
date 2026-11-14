import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { FormField } from '../../../shared/components/FormField/FormField';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { ApiError } from '../../../shared/api/client';
import { createPage } from '../../../shared/cms/api';
import { buildMeditationSeedContent, slugify } from '../../../shared/cms/meditationContent';
import f from '../../../shared/components/FormField/FormField.module.css';
import styles from './MeditacionesAdmin.module.css';

/** `/admin/meditaciones/nueva` — creates the meditation page (as a draft), then opens its editor. */
export function NuevaMeditacionPage() {
  useDocumentTitle('Nueva meditación · Admin · Nuestra Medicina Personal');
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugEdited ? slug : slugify(title);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !effectiveSlug) return;
    setCreating(true);
    setError(null);
    try {
      await createPage({
        type: 'MEDITACION',
        bookId: null,
        slug: effectiveSlug,
        title: trimmed,
        content: buildMeditationSeedContent(trimmed),
      });
      navigate(`/admin/meditaciones/${effectiveSlug}`);
    } catch (caught: unknown) {
      setError(
        caught instanceof ApiError && caught.status === 409
          ? 'Ya existe una página con esa dirección. Probá con otra.'
          : caught instanceof ApiError && caught.status === 422
            ? 'Revisá el título y la dirección: la dirección sólo admite minúsculas, números y guiones.'
            : 'No pudimos crear la meditación. Intentá nuevamente.',
      );
      setCreating(false);
    }
  };

  return (
    <AdminLayout title="Nueva meditación">
      <div className={styles.panel}>
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <FormField label="Título" htmlFor="meditationTitle">
            <input
              id="meditationTitle"
              type="text"
              className={f.control}
              value={title}
              maxLength={200}
              required
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Por ejemplo: Volver al cuerpo"
            />
          </FormField>

          <FormField label="Dirección" htmlFor="meditationSlug">
            <input
              id="meditationSlug"
              type="text"
              className={f.control}
              value={effectiveSlug}
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(event.target.value);
              }}
            />
          </FormField>
          <p className={styles.hint}>La página va a quedar en /meditaciones/{effectiveSlug || '…'}</p>

          <div className={styles.formActions}>
            <Button variant="primary" type="submit" disabled={creating || !title.trim() || !effectiveSlug}>
              {creating ? 'Creando…' : 'Crear y editar'}
            </Button>
            <Button variant="secondary" to="/admin/meditaciones">
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
