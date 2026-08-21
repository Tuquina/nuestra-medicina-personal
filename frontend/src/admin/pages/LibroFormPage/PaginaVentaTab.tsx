import { useCallback, useEffect, useState } from 'react';
import { FormField } from '../../../shared/components/FormField/FormField';
import f from '../../../shared/components/FormField/FormField.module.css';
import { useEditablePage } from '../../../shared/cms/useEditablePage';
import { CmsEditorActions, CmsEditorLoadState } from '../../components/CmsEditorTools/CmsEditorTools';
import { BOOK_LANDING_SECTION_TYPE, buildBookLandingSeedContent, readBookLandingProps, type BookLandingProps } from '../../../shared/cms/bookLandingContent';
import { apiRequest } from '../../../shared/api/client';
import { ADMIN_BOOKS_URL } from '../../../shared/config/api';
import type { AdminBook, AdminBookList } from '../../books/types';
import type { BenefitsSection, ImageTextSection } from '../../../public-store/data/bookLandings';
import styles from './PaginaVentaTab.module.css';

interface PaginaVentaTabProps {
  bookId: string | null;
  slug: string;
  bookTitle: string;
}

/**
 * The book's own landing-page editor — simpler and more specific than the
 * generic Page Builder: no blocks to add or reorder, just the real fields
 * `/libros/:slug` renders (see public-store/pages/BookLandingPage). Every
 * field here is wired straight to the CMS API through `shared/cms`; the
 * public page reads only its published representation, so "Publicar" here
 * changes what a visitor actually sees.
 */
export function PaginaVentaTab({ bookId, slug, bookTitle }: PaginaVentaTabProps) {
  if (!bookId || !slug) {
    return (
      <div className={styles.emptyCard}>
        <p className={styles.emptyText}>
          Guardá el título y el slug del libro en la pestaña "Información" antes de editar su página de venta.
        </p>
      </div>
    );
  }

  return <PaginaVentaEditor bookId={bookId} slug={slug} bookTitle={bookTitle} />;
}

function PaginaVentaEditor({ bookId, slug, bookTitle }: PaginaVentaTabProps) {
  const seed = useCallback(() => buildBookLandingSeedContent(slug), [slug]);
  const editor = useEditablePage({
    type: 'BOOK', slug, title: bookTitle, bookId: bookId ?? undefined, seed,
  });
  const { content, setContent } = editor;
  const landing = readBookLandingProps(content);

  const update = (patch: Partial<BookLandingProps>) => {
    setContent({
      schemaVersion: 1,
      sections: [{ id: 'book-landing', type: BOOK_LANDING_SECTION_TYPE, props: { ...landing, ...patch } }],
    });
  };

  const [otherBooks, setOtherBooks] = useState<AdminBook[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<AdminBookList>(ADMIN_BOOKS_URL, { signal: controller.signal })
      .then((response) => setOtherBooks(response.items.filter((book) => book.slug !== slug)))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      });
    return () => controller.abort();
  }, [slug]);

  if (editor.loadStatus !== 'ready') return <CmsEditorLoadState editor={editor} />;

  return (
    <div className={f.stack}>
      <CmsEditorActions editor={editor} content={content} publicPath={`/libros/${slug}?preview=1`} />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Presentación</h2>
        <p className={styles.sectionHint}>Lo primero que ve alguien al entrar a la página de "{bookTitle}".</p>

        <FormField label="Autor/a (como aparece en esta página)" htmlFor="landingAuthor">
          <input
            id="landingAuthor"
            type="text"
            className={f.control}
            value={landing.authorName}
            onChange={(e) => update({ authorName: e.target.value })}
          />
        </FormField>

        <FormField label="Frase de presentación" htmlFor="tagline">
          <input
            id="tagline"
            type="text"
            className={f.control}
            value={landing.tagline}
            onChange={(e) => update({ tagline: e.target.value })}
          />
        </FormField>

        <FormField label="Descripción" htmlFor="heroDescription">
          <textarea
            id="heroDescription"
            rows={3}
            className={f.control}
            value={landing.heroDescription}
            onChange={(e) => update({ heroDescription: e.target.value })}
          />
        </FormField>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Sinopsis</h2>
        <p className={styles.sectionHint}>Uno o más párrafos, en orden.</p>

        {landing.synopsisParagraphs.map((paragraph, i) => (
          <div key={i} className={styles.listRow}>
            <textarea
              rows={2}
              className={f.control}
              value={paragraph}
              onChange={(e) => {
                const next = [...landing.synopsisParagraphs];
                next[i] = e.target.value;
                update({ synopsisParagraphs: next });
              }}
            />
            <button
              type="button"
              className={styles.removeButton}
              title="Quitar párrafo"
              aria-label="Quitar párrafo"
              onClick={() => update({ synopsisParagraphs: landing.synopsisParagraphs.filter((_, idx) => idx !== i) })}
              disabled={landing.synopsisParagraphs.length <= 1}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.addButton}
          onClick={() => update({ synopsisParagraphs: [...landing.synopsisParagraphs, ''] })}
        >
          + Agregar párrafo
        </button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Sección intermedia</h2>
        <p className={styles.sectionHint}>Elegí cómo mostrar el contenido central de la página.</p>

        <FormField label="Tipo" htmlFor="middleType">
          <select
            id="middleType"
            className={f.control}
            value={landing.middleSection.type}
            onChange={(e) => {
              const type = e.target.value as 'image-text' | 'benefits';
              update({
                middleSection:
                  type === 'image-text'
                    ? { type: 'image-text', heading: '', text: '', imageAccent: 'var(--color-sky-pale)', imageCaption: 'Foto — descripción' }
                    : { type: 'benefits', heading: '', items: [{ title: '', description: '' }] },
              });
            }}
          >
            <option value="image-text">Imagen + texto</option>
            <option value="benefits">Lista de beneficios</option>
          </select>
        </FormField>

        <FormField label="Título de la sección" htmlFor="middleHeading">
          <input
            id="middleHeading"
            type="text"
            className={f.control}
            value={landing.middleSection.heading}
            onChange={(e) => update({ middleSection: { ...landing.middleSection, heading: e.target.value } })}
          />
        </FormField>

        {landing.middleSection.type === 'image-text' ? (
          <ImageTextFields
            middle={landing.middleSection}
            onChange={(next) => update({ middleSection: next })}
          />
        ) : (
          <BenefitsFields
            middle={landing.middleSection}
            onChange={(next) => update({ middleSection: next })}
          />
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Cita destacada</h2>
        <FormField label="Frase" htmlFor="quote">
          <textarea
            id="quote"
            rows={2}
            className={f.control}
            value={landing.quote}
            onChange={(e) => update({ quote: e.target.value })}
          />
        </FormField>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Detalles del libro</h2>
        <div className={[f.row, f.row3].join(' ')}>
          <FormField label="Fecha de publicación" htmlFor="pubDate">
            <input
              id="pubDate"
              type="text"
              className={f.control}
              value={landing.publicationDate}
              onChange={(e) => update({ publicationDate: e.target.value })}
            />
          </FormField>
          <FormField label="ISBN" htmlFor="landingIsbn">
            <input
              id="landingIsbn"
              type="text"
              className={f.control}
              value={landing.isbn}
              onChange={(e) => update({ isbn: e.target.value })}
            />
          </FormField>
          <FormField label="Tamaño del archivo" htmlFor="fileSize">
            <input
              id="fileSize"
              type="text"
              className={f.control}
              value={landing.fileSize}
              onChange={(e) => update({ fileSize: e.target.value })}
            />
          </FormField>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Preguntas frecuentes</h2>
        <p className={styles.sectionHint}>Opcional — dejalo vacío para no mostrar esta sección.</p>

        {(landing.faqs ?? []).map((faq, i) => (
          <div key={i} className={styles.faqRow}>
            <input
              type="text"
              placeholder="Pregunta"
              className={f.control}
              value={faq.q}
              onChange={(e) => {
                const next = [...(landing.faqs ?? [])];
                next[i] = { ...next[i], q: e.target.value };
                update({ faqs: next });
              }}
            />
            <textarea
              rows={2}
              placeholder="Respuesta"
              className={f.control}
              value={faq.a}
              onChange={(e) => {
                const next = [...(landing.faqs ?? [])];
                next[i] = { ...next[i], a: e.target.value };
                update({ faqs: next });
              }}
            />
            <button
              type="button"
              className={styles.removeButton}
              title="Quitar pregunta"
              aria-label="Quitar pregunta"
              onClick={() => update({ faqs: (landing.faqs ?? []).filter((_, idx) => idx !== i) })}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.addButton}
          onClick={() => update({ faqs: [...(landing.faqs ?? []), { q: '', a: '' }] })}
        >
          + Agregar pregunta
        </button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Libro relacionado</h2>
        <FormField label="Se muestra al final de la página" htmlFor="relatedSlug">
          <select
            id="relatedSlug"
            className={f.control}
            value={landing.relatedSlug}
            onChange={(e) => update({ relatedSlug: e.target.value })}
          >
            <option value="">Ninguno</option>
            {otherBooks.map((book) => (
              <option key={book.slug} value={book.slug}>
                {book.title}
              </option>
            ))}
          </select>
        </FormField>
      </section>
    </div>
  );
}

/** Split out so `middle`'s type is a plain narrowed const, not a
 * property access re-widened inside each input's onChange closure. */
function ImageTextFields({ middle, onChange }: { middle: ImageTextSection; onChange: (next: ImageTextSection) => void }) {
  return (
    <>
      <FormField label="Texto" htmlFor="middleText">
        <textarea
          id="middleText"
          rows={3}
          className={f.control}
          value={middle.text}
          onChange={(e) => onChange({ ...middle, text: e.target.value })}
        />
      </FormField>
      <FormField label="Descripción de la imagen" htmlFor="middleImageCaption">
        <input
          id="middleImageCaption"
          type="text"
          className={f.control}
          value={middle.imageCaption}
          onChange={(e) => onChange({ ...middle, imageCaption: e.target.value })}
        />
      </FormField>
    </>
  );
}

function BenefitsFields({ middle, onChange }: { middle: BenefitsSection; onChange: (next: BenefitsSection) => void }) {
  return (
    <>
      {middle.items.map((item, i) => (
        <div key={i} className={styles.benefitRow}>
          <input
            type="text"
            placeholder="Título"
            className={f.control}
            value={item.title}
            onChange={(e) => {
              const next = [...middle.items];
              next[i] = { ...next[i], title: e.target.value };
              onChange({ ...middle, items: next });
            }}
          />
          <input
            type="text"
            placeholder="Descripción"
            className={f.control}
            value={item.description}
            onChange={(e) => {
              const next = [...middle.items];
              next[i] = { ...next[i], description: e.target.value };
              onChange({ ...middle, items: next });
            }}
          />
          <button
            type="button"
            className={styles.removeButton}
            title="Quitar"
            aria-label="Quitar beneficio"
            disabled={middle.items.length <= 1}
            onClick={() => onChange({ ...middle, items: middle.items.filter((_, idx) => idx !== i) })}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.addButton}
        onClick={() => onChange({ ...middle, items: [...middle.items, { title: '', description: '' }] })}
      >
        + Agregar beneficio
      </button>
    </>
  );
}
