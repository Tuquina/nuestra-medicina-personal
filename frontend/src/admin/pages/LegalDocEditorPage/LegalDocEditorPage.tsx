import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { FormField } from '../../../shared/components/FormField/FormField';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useEditablePage } from '../../../shared/cms/useEditablePage';
import { CmsEditorActions, CmsEditorLoadState } from '../../components/CmsEditorTools/CmsEditorTools';
import type { PageContent, PageType } from '../../../shared/cms/types';
import { LEGAL_DOC_SECTION_TYPE, readLegalDocProps, type LegalDocSection, type LegalDocProps } from '../../../shared/cms/legalDocContent';
import f from '../../../shared/components/FormField/FormField.module.css';
import styles from '../../components/EditorForm/EditorForm.module.css';

interface LegalDocEditorPageProps {
  pageType: Extract<PageType, 'TERMINOS' | 'PRIVACIDAD'>;
  slug: string;
  seed: () => PageContent;
  heading: string;
  /** The public route this content renders on, e.g. "/terminos". */
  publicPath: string;
}

/**
 * A generic editor for the two long legal documents (Términos,
 * Privacidad) — title, "última actualización" line, an intro note, and
 * an ordered list of numbered sections. Each section's body is a plain
 * `<textarea>` in a small markdown-lite dialect (blank line = new
 * paragraph, `- ` = bullet, `> ` = highlighted note, `**bold**`) — see
 * `shared/cms/legalDocContent.ts` for the exact rules and
 * `legalDocRenderer.tsx` for how it's parsed on the public page. No rich
 * text editor needed for something this structured.
 */
export function LegalDocEditorPage({ pageType, slug, seed, heading, publicPath }: LegalDocEditorPageProps) {
  useDocumentTitle(`${heading} · Admin · Nuestra Medicina Personal`);

  const editor = useEditablePage({
    type: pageType,
    slug,
    title: heading,
    seed,
  });
  const { content, setContent } = editor;
  const doc = readLegalDocProps(content);

  const update = (patch: Partial<LegalDocProps>) => {
    setContent({
      schemaVersion: 1,
      sections: [{ id: 'doc', type: LEGAL_DOC_SECTION_TYPE, props: { ...doc, ...patch } }],
    });
  };

  if (editor.loadStatus !== 'ready') {
    return <AdminLayout title={heading}><CmsEditorLoadState editor={editor} /></AdminLayout>;
  }

  return (
    <AdminLayout title={heading}>
      <CmsEditorActions editor={editor} content={content} publicPath={`${publicPath}?preview=1`} />

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Presentación</h2>

        <FormField label="Título" htmlFor="docTitle">
          <input
            id="docTitle"
            type="text"
            className={f.control}
            value={doc.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </FormField>

        <FormField label="Última actualización" htmlFor="docUpdated">
          <input
            id="docUpdated"
            type="text"
            className={f.control}
            value={doc.updatedLabel}
            onChange={(e) => update({ updatedLabel: e.target.value })}
          />
        </FormField>

        <FormField label="Nota introductoria" htmlFor="docIntro">
          <textarea
            id="docIntro"
            rows={3}
            className={f.control}
            value={doc.introNote}
            onChange={(e) => update({ introNote: e.target.value })}
          />
        </FormField>
        <p className={styles.sectionHint}>
          Se muestra destacada arriba de todo. Usá **texto** para negrita.
        </p>
      </div>

      <SectionsEditor sections={doc.sections} onChange={(sections) => update({ sections })} />
    </AdminLayout>
  );
}

/** Split out so new-section id generation (an impure `Date.now()` call
 * — fine since it only ever runs from a click handler) and this list's
 * `key={section.id}` mapping aren't traced together by the React
 * Compiler's purity check within one component. */
function SectionsEditor({
  sections,
  onChange,
}: {
  sections: LegalDocSection[];
  onChange: (sections: LegalDocSection[]) => void;
}) {
  const updateSection = (id: string, patch: Partial<LegalDocSection>) => {
    onChange(sections.map((section) => (section.id === id ? { ...section, ...patch } : section)));
  };

  const addSection = () => {
    const id = `section-${Date.now()}`;
    const number = sections.length + 1;
    onChange([...sections, { id, title: `${number}. Nueva sección`, body: '' }]);
  };

  const removeSection = (id: string) => {
    onChange(sections.filter((section) => section.id !== id));
  };

  const moveSection = (id: string, dir: -1 | 1) => {
    const i = sections.findIndex((section) => section.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Secciones</h2>
      <p className={styles.sectionHint}>
        Línea en blanco = nuevo párrafo. Líneas que empiezan con "- " se muestran como lista. Una línea que empieza
        con "&gt; " se muestra destacada, como una nota.
      </p>

      {sections.map((section, i) => (
        <div key={section.id} className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Sección {i + 1}</span>
            <div className={styles.cardActions}>
              <button
                type="button"
                className={styles.removeButton}
                title="Mover arriba"
                aria-label="Mover arriba"
                disabled={i === 0}
                onClick={() => moveSection(section.id, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className={styles.removeButton}
                title="Mover abajo"
                aria-label="Mover abajo"
                disabled={i === sections.length - 1}
                onClick={() => moveSection(section.id, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className={styles.removeButton}
                title="Quitar sección"
                aria-label="Quitar sección"
                onClick={() => removeSection(section.id)}
              >
                ✕
              </button>
            </div>
          </div>

          <FormField label="Título" htmlFor={`sectionTitle-${section.id}`}>
            <input
              id={`sectionTitle-${section.id}`}
              type="text"
              className={f.control}
              value={section.title}
              onChange={(e) => updateSection(section.id, { title: e.target.value })}
            />
          </FormField>

          <FormField label="Contenido" htmlFor={`sectionBody-${section.id}`}>
            <textarea
              id={`sectionBody-${section.id}`}
              rows={6}
              className={[f.control, f.mono].join(' ')}
              value={section.body}
              onChange={(e) => updateSection(section.id, { body: e.target.value })}
            />
          </FormField>
        </div>
      ))}

      <button type="button" className={styles.addButton} onClick={addSection}>
        + Agregar sección
      </button>
    </div>
  );
}
