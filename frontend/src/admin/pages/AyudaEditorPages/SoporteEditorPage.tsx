import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { FormField } from '../../../shared/components/FormField/FormField';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useEditablePage } from '../../../shared/cms/useEditablePage';
import { CmsEditorActions, CmsEditorLoadState } from '../../components/CmsEditorTools/CmsEditorTools';
import {
  buildSoporteSeedContent,
  SOPORTE_SECTION_TYPE,
  SOPORTE_SLUG,
  readSoporteProps,
  type SoporteProps,
  type SupportTopic,
} from '../../../shared/cms/helpContent';
import f from '../../../shared/components/FormField/FormField.module.css';
import styles from '../../components/EditorForm/EditorForm.module.css';

/** `/admin/ayuda/soporte` */
export function SoporteEditorPage() {
  useDocumentTitle('Soporte · Admin · Nuestra Medicina Personal');

  const editor = useEditablePage({
    type: 'SOPORTE', slug: SOPORTE_SLUG, title: 'Soporte', seed: buildSoporteSeedContent,
  });
  const { content, setContent } = editor;
  const page = readSoporteProps(content);

  const update = (patch: Partial<SoporteProps>) => {
    setContent({
      schemaVersion: 1,
      sections: [{ id: SOPORTE_SECTION_TYPE, type: SOPORTE_SECTION_TYPE, props: { ...page, ...patch } }],
    });
  };

  if (editor.loadStatus !== 'ready') {
    return <AdminLayout title="Soporte"><CmsEditorLoadState editor={editor} /></AdminLayout>;
  }

  return (
    <AdminLayout title="Soporte">
      <CmsEditorActions editor={editor} content={content} publicPath="/soporte?preview=1" />

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Presentación</h2>

        <FormField label="Título" htmlFor="soporteTitle">
          <input
            id="soporteTitle"
            type="text"
            className={f.control}
            value={page.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </FormField>

        <FormField label="Descripción" htmlFor="soporteIntro">
          <textarea
            id="soporteIntro"
            rows={2}
            className={f.control}
            value={page.intro}
            onChange={(e) => update({ intro: e.target.value })}
          />
        </FormField>
      </div>

      <TopicsEditor topics={page.topics} onChange={(topics) => update({ topics })} />
    </AdminLayout>
  );
}

function TopicsEditor({ topics, onChange }: { topics: SupportTopic[]; onChange: (topics: SupportTopic[]) => void }) {
  const updateTopic = (id: string, patch: Partial<SupportTopic>) => {
    onChange(topics.map((topic) => (topic.id === id ? { ...topic, ...patch } : topic)));
  };

  const addTopic = () => {
    const id = `topic-${Date.now()}`;
    onChange([...topics, { id, title: '', description: '' }]);
  };

  const removeTopic = (id: string) => {
    onChange(topics.filter((topic) => topic.id !== id));
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Temas de ayuda</h2>
      <p className={styles.sectionHint}>Se muestran como tarjetas debajo de la presentación.</p>

      {topics.map((topic, i) => (
        <div key={topic.id} className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Tema {i + 1}</span>
            <button
              type="button"
              className={styles.removeButton}
              title="Quitar"
              aria-label="Quitar tema"
              disabled={topics.length <= 1}
              onClick={() => removeTopic(topic.id)}
            >
              ✕
            </button>
          </div>

          <FormField label="Título" htmlFor={`topicTitle-${topic.id}`}>
            <input
              id={`topicTitle-${topic.id}`}
              type="text"
              className={f.control}
              value={topic.title}
              onChange={(e) => updateTopic(topic.id, { title: e.target.value })}
            />
          </FormField>

          <FormField label="Descripción" htmlFor={`topicDescription-${topic.id}`}>
            <textarea
              id={`topicDescription-${topic.id}`}
              rows={2}
              className={f.control}
              value={topic.description}
              onChange={(e) => updateTopic(topic.id, { description: e.target.value })}
            />
          </FormField>
        </div>
      ))}

      <button type="button" className={styles.addButton} onClick={addTopic}>
        + Agregar tema
      </button>
    </div>
  );
}
