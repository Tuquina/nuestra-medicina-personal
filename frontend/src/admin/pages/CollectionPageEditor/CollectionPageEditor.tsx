import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { FormField } from '../../../shared/components/FormField/FormField';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useEditablePage } from '../../../shared/cms/useEditablePage';
import type { PageContent, PageType } from '../../../shared/cms/types';
import { COLLECTION_SECTION_TYPE, readCollectionProps, type CollectionCard, type CollectionPageProps } from '../../../shared/cms/collectionContent';
import f from '../../../shared/components/FormField/FormField.module.css';
import styles from '../../components/EditorForm/EditorForm.module.css';

interface CollectionPageEditorProps {
  pageType: Extract<PageType, 'MEDITACIONES' | 'HERRAMIENTAS'>;
  slug: string;
  seed: () => PageContent;
  heading: string;
  /** The public route this content renders on, e.g. "/meditaciones". */
  publicPath: string;
}

/**
 * A small, purpose-built editor for the two "coming soon" collection
 * pages (Meditaciones, Herramientas) — a hero + N preview cards, nothing
 * else, so a dedicated form is simpler to use than opening the generic
 * Page Builder for a page that doesn't have swappable blocks. Same
 * shared/cms wiring as the Home and book-page editors: "Publicar" here
 * changes what `publicPath` actually shows.
 */
export function CollectionPageEditor({ pageType, slug, seed, heading, publicPath }: CollectionPageEditorProps) {
  useDocumentTitle(`${heading} · Admin · Nuestra Medicina Personal`);

  const { content, setContent, saveDraftNow, publish, dirtySincePublish } = useEditablePage(pageType, slug, seed);
  const page = readCollectionProps(content);

  const update = (patch: Partial<CollectionPageProps>) => {
    setContent({
      schemaVersion: 1,
      sections: [{ id: 'collection', type: COLLECTION_SECTION_TYPE, props: { ...page, ...patch } }],
    });
  };

  return (
    <AdminLayout title={heading}>
      <div className={styles.toolbar}>
        <span className={[styles.statusBadge, dirtySincePublish ? styles.statusUnsaved : styles.statusPublished].join(' ')}>
          {dirtySincePublish ? 'Cambios sin publicar' : 'Publicado'}
        </span>
        <div className={styles.toolbarActions}>
          <Button
            variant="secondary"
            onClick={() => {
              saveDraftNow(content);
              window.open(`${publicPath}?preview=1`, '_blank', 'noopener');
            }}
          >
            Vista previa
          </Button>
          <Button variant="secondary" onClick={() => saveDraftNow(content)}>
            Guardar borrador
          </Button>
          <Button variant="primary" onClick={publish}>
            Publicar
          </Button>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Presentación</h2>
        <p className={styles.sectionHint}>El título y la descripción que aparecen arriba de las tarjetas.</p>

        <FormField label="Título" htmlFor="collectionTitle">
          <input
            id="collectionTitle"
            type="text"
            className={f.control}
            value={page.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </FormField>

        <FormField label="Descripción" htmlFor="collectionDescription">
          <textarea
            id="collectionDescription"
            rows={2}
            className={f.control}
            value={page.description}
            onChange={(e) => update({ description: e.target.value })}
          />
        </FormField>
      </div>

      <CardsEditor cards={page.cards} onChange={(cards) => update({ cards })} />
    </AdminLayout>
  );
}

/** Split out from `CollectionPageEditor` so new-card id generation
 * (`addCard`, an impure `Date.now()` call — fine since it only ever runs
 * from a click handler) and this list's `key={card.id}` mapping aren't
 * traced together by the React Compiler's purity check within one
 * component (same reasoning as `PageBuilderPage` vs. its `Canvas`). */
function CardsEditor({ cards, onChange }: { cards: CollectionCard[]; onChange: (cards: CollectionCard[]) => void }) {
  const updateCard = (id: string, patch: Partial<CollectionCard>) => {
    onChange(cards.map((card) => (card.id === id ? { ...card, ...patch } : card)));
  };

  const addCard = () => {
    const id = `card-${Date.now()}`;
    onChange([...cards, { id, title: '', description: '', imageCaption: '' }]);
  };

  const removeCard = (id: string) => {
    onChange(cards.filter((card) => card.id !== id));
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Tarjetas</h2>
      <p className={styles.sectionHint}>Cada una se muestra con la etiqueta "Próximamente".</p>

      {cards.map((card, i) => (
        <div key={card.id} className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Tarjeta {i + 1}</span>
            <button
              type="button"
              className={styles.removeButton}
              title="Quitar tarjeta"
              aria-label="Quitar tarjeta"
              disabled={cards.length <= 1}
              onClick={() => removeCard(card.id)}
            >
              ✕
            </button>
          </div>

          <FormField label="Título" htmlFor={`cardTitle-${card.id}`}>
            <input
              id={`cardTitle-${card.id}`}
              type="text"
              className={f.control}
              value={card.title}
              onChange={(e) => updateCard(card.id, { title: e.target.value })}
            />
          </FormField>

          <FormField label="Descripción" htmlFor={`cardDescription-${card.id}`}>
            <textarea
              id={`cardDescription-${card.id}`}
              rows={2}
              className={f.control}
              value={card.description}
              onChange={(e) => updateCard(card.id, { description: e.target.value })}
            />
          </FormField>

          <FormField label="Descripción de la imagen" htmlFor={`cardImage-${card.id}`}>
            <input
              id={`cardImage-${card.id}`}
              type="text"
              className={f.control}
              value={card.imageCaption}
              onChange={(e) => updateCard(card.id, { imageCaption: e.target.value })}
            />
          </FormField>
        </div>
      ))}

      <button type="button" className={styles.addButton} onClick={addCard}>
        + Agregar tarjeta
      </button>
    </div>
  );
}
