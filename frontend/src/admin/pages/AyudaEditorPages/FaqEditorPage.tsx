import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { FormField } from '../../../shared/components/FormField/FormField';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useEditablePage } from '../../../shared/cms/useEditablePage';
import {
  buildFaqSeedContent,
  FAQ_SECTION_TYPE,
  FAQ_SLUG,
  readFaqProps,
  type FaqItem,
  type FaqPageProps,
} from '../../../shared/cms/helpContent';
import f from '../../../shared/components/FormField/FormField.module.css';
import styles from '../../components/EditorForm/EditorForm.module.css';

/** `/admin/ayuda/preguntas-frecuentes` */
export function FaqEditorPage() {
  useDocumentTitle('Preguntas frecuentes · Admin · Nuestra Medicina Personal');

  const { content, setContent, saveDraftNow, publish, dirtySincePublish } = useEditablePage(
    'FAQ',
    FAQ_SLUG,
    buildFaqSeedContent,
  );
  const page = readFaqProps(content);

  const update = (patch: Partial<FaqPageProps>) => {
    setContent({
      schemaVersion: 1,
      sections: [{ id: FAQ_SECTION_TYPE, type: FAQ_SECTION_TYPE, props: { ...page, ...patch } }],
    });
  };

  return (
    <AdminLayout title="Preguntas frecuentes">
      <div className={styles.toolbar}>
        <span className={[styles.statusBadge, dirtySincePublish ? styles.statusUnsaved : styles.statusPublished].join(' ')}>
          {dirtySincePublish ? 'Cambios sin publicar' : 'Publicado'}
        </span>
        <div className={styles.toolbarActions}>
          <Button
            variant="secondary"
            onClick={() => {
              saveDraftNow(content);
              window.open('/preguntas-frecuentes?preview=1', '_blank', 'noopener');
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

        <FormField label="Título" htmlFor="faqTitle">
          <input
            id="faqTitle"
            type="text"
            className={f.control}
            value={page.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </FormField>

        <FormField label="Descripción" htmlFor="faqIntro">
          <textarea
            id="faqIntro"
            rows={2}
            className={f.control}
            value={page.intro}
            onChange={(e) => update({ intro: e.target.value })}
          />
        </FormField>
      </div>

      <FaqsEditor faqs={page.faqs} onChange={(faqs) => update({ faqs })} />
    </AdminLayout>
  );
}

function FaqsEditor({ faqs, onChange }: { faqs: FaqItem[]; onChange: (faqs: FaqItem[]) => void }) {
  const updateFaq = (id: string, patch: Partial<FaqItem>) => {
    onChange(faqs.map((faq) => (faq.id === id ? { ...faq, ...patch } : faq)));
  };

  const addFaq = () => {
    const id = `faq-${Date.now()}`;
    onChange([...faqs, { id, q: '', a: '' }]);
  };

  const removeFaq = (id: string) => {
    onChange(faqs.filter((faq) => faq.id !== id));
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Preguntas</h2>
      <p className={styles.sectionHint}>Se muestran como acordeón, en este orden.</p>

      {faqs.map((faq, i) => (
        <div key={faq.id} className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Pregunta {i + 1}</span>
            <button
              type="button"
              className={styles.removeButton}
              title="Quitar"
              aria-label="Quitar pregunta"
              disabled={faqs.length <= 1}
              onClick={() => removeFaq(faq.id)}
            >
              ✕
            </button>
          </div>

          <FormField label="Pregunta" htmlFor={`faqQ-${faq.id}`}>
            <input
              id={`faqQ-${faq.id}`}
              type="text"
              className={f.control}
              value={faq.q}
              onChange={(e) => updateFaq(faq.id, { q: e.target.value })}
            />
          </FormField>

          <FormField label="Respuesta" htmlFor={`faqA-${faq.id}`}>
            <textarea
              id={`faqA-${faq.id}`}
              rows={3}
              className={f.control}
              value={faq.a}
              onChange={(e) => updateFaq(faq.id, { a: e.target.value })}
            />
          </FormField>
        </div>
      ))}

      <button type="button" className={styles.addButton} onClick={addFaq}>
        + Agregar pregunta
      </button>
    </div>
  );
}
