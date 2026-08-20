import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { FormField } from '../../../shared/components/FormField/FormField';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useEditablePage } from '../../../shared/cms/useEditablePage';
import { CmsEditorActions, CmsEditorLoadState } from '../../components/CmsEditorTools/CmsEditorTools';
import {
  buildContactoSeedContent,
  CONTACTO_SECTION_TYPE,
  CONTACTO_SLUG,
  readContactoProps,
  type ContactMethod,
  type ContactoProps,
} from '../../../shared/cms/helpContent';
import f from '../../../shared/components/FormField/FormField.module.css';
import styles from '../../components/EditorForm/EditorForm.module.css';

/** `/admin/ayuda/contacto` */
export function ContactoEditorPage() {
  useDocumentTitle('Contacto · Admin · Nuestra Medicina Personal');

  const editor = useEditablePage({
    type: 'CONTACTO', slug: CONTACTO_SLUG, title: 'Contacto', seed: buildContactoSeedContent,
  });
  const { content, setContent } = editor;
  const page = readContactoProps(content);

  const update = (patch: Partial<ContactoProps>) => {
    setContent({
      schemaVersion: 1,
      sections: [{ id: CONTACTO_SECTION_TYPE, type: CONTACTO_SECTION_TYPE, props: { ...page, ...patch } }],
    });
  };

  if (editor.loadStatus !== 'ready') {
    return <AdminLayout title="Contacto"><CmsEditorLoadState editor={editor} /></AdminLayout>;
  }

  return (
    <AdminLayout title="Contacto">
      <CmsEditorActions editor={editor} content={content} publicPath="/contacto?preview=1" />

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Presentación</h2>

        <FormField label="Título" htmlFor="contactoTitle">
          <input
            id="contactoTitle"
            type="text"
            className={f.control}
            value={page.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </FormField>

        <FormField label="Descripción" htmlFor="contactoIntro">
          <textarea
            id="contactoIntro"
            rows={2}
            className={f.control}
            value={page.intro}
            onChange={(e) => update({ intro: e.target.value })}
          />
        </FormField>
      </div>

      <MethodsEditor methods={page.methods} onChange={(methods) => update({ methods })} />
    </AdminLayout>
  );
}

function MethodsEditor({
  methods,
  onChange,
}: {
  methods: ContactMethod[];
  onChange: (methods: ContactMethod[]) => void;
}) {
  const updateMethod = (id: string, patch: Partial<ContactMethod>) => {
    onChange(methods.map((method) => (method.id === id ? { ...method, ...patch } : method)));
  };

  const addMethod = () => {
    const id = `method-${Date.now()}`;
    onChange([...methods, { id, label: '', value: '', href: '' }]);
  };

  const removeMethod = (id: string) => {
    onChange(methods.filter((method) => method.id !== id));
  };

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Formas de contacto</h2>
      <p className={styles.sectionHint}>Por ejemplo correo electrónico, teléfono o redes sociales.</p>

      {methods.map((method, i) => (
        <div key={method.id} className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Método {i + 1}</span>
            <button
              type="button"
              className={styles.removeButton}
              title="Quitar"
              aria-label="Quitar método"
              disabled={methods.length <= 1}
              onClick={() => removeMethod(method.id)}
            >
              ✕
            </button>
          </div>

          <FormField label="Etiqueta" htmlFor={`methodLabel-${method.id}`}>
            <input
              id={`methodLabel-${method.id}`}
              type="text"
              placeholder="Correo"
              className={f.control}
              value={method.label}
              onChange={(e) => updateMethod(method.id, { label: e.target.value })}
            />
          </FormField>

          <FormField label="Valor visible" htmlFor={`methodValue-${method.id}`}>
            <input
              id={`methodValue-${method.id}`}
              type="text"
              placeholder="soporte@nuestramedicinapersonal.com"
              className={f.control}
              value={method.value}
              onChange={(e) => updateMethod(method.id, { value: e.target.value })}
            />
          </FormField>

          <FormField label="Enlace" htmlFor={`methodHref-${method.id}`}>
            <input
              id={`methodHref-${method.id}`}
              type="text"
              placeholder="mailto:soporte@nuestramedicinapersonal.com"
              className={[f.control, f.mono].join(' ')}
              value={method.href}
              onChange={(e) => updateMethod(method.id, { href: e.target.value })}
            />
          </FormField>
        </div>
      ))}

      <button type="button" className={styles.addButton} onClick={addMethod}>
        + Agregar método
      </button>
    </div>
  );
}
