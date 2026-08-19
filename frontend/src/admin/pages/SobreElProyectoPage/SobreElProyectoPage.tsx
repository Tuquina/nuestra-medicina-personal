import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { FormField } from '../../../shared/components/FormField/FormField';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useEditablePage } from '../../../shared/cms/useEditablePage';
import { buildHomeSeedContent, type AboutProps } from '../../../shared/cms/homeContent';
import { HOME_SLUG } from '../../../shared/cms/types';
import f from '../../../shared/components/FormField/FormField.module.css';
import styles from './SobreElProyectoPage.module.css';

const DEFAULT_ABOUT: AboutProps = { eyebrow: 'Sobre el proyecto', title: '', bio: '', imageCaption: '' };

/**
 * `/admin/sobre-el-proyecto` — a small dedicated editor for the Home
 * page's "Sobre el proyecto" bio, instead of having to open the full
 * Page Builder to change a paragraph of text. Edits the exact same
 * `about` section the Page Builder's "Sobre el proyecto" block edits —
 * same Home content record, just reached through a simpler, purpose-built
 * form (what was asked for: "escribir sobre el proyecto más fácilmente").
 */
export function SobreElProyectoPage() {
  useDocumentTitle('Sobre el proyecto · Admin · Nuestra Medicina Personal');

  const { content, setContent, saveDraftNow, publish, dirtySincePublish } = useEditablePage(
    'HOME',
    HOME_SLUG,
    buildHomeSeedContent,
  );

  const aboutSection = content.sections.find((section) => section.type === 'about');
  const about = (aboutSection?.props as AboutProps | undefined) ?? DEFAULT_ABOUT;

  const update = (patch: Partial<AboutProps>) => {
    if (!aboutSection) return;
    setContent({
      ...content,
      sections: content.sections.map((section) =>
        section.id === aboutSection.id ? { ...section, props: { ...about, ...patch } } : section,
      ),
    });
  };

  return (
    <AdminLayout title="Sobre el proyecto">
      <div className={styles.toolbar}>
        <span className={[styles.statusBadge, dirtySincePublish ? styles.statusUnsaved : styles.statusPublished].join(' ')}>
          {dirtySincePublish ? 'Cambios sin publicar' : 'Publicado'}
        </span>
        <div className={styles.toolbarActions}>
          <Button
            variant="secondary"
            onClick={() => {
              saveDraftNow(content);
              window.open('/?preview=1#sobre-el-proyecto', '_blank', 'noopener');
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

      {!aboutSection ? (
        <div className={styles.section}>
          <p className={styles.sectionHint}>
            El bloque "Sobre el proyecto" no existe en la página de Inicio — se eliminó desde el editor de Inicio.
            Agregalo de nuevo desde ahí para poder editarlo acá.
          </p>
        </div>
      ) : (
        <div className={styles.section}>
          <p className={styles.sectionHint}>
            Esto es lo que se muestra en la sección "Sobre el proyecto" de la página de Inicio.
          </p>

          <FormField label="Texto superior" htmlFor="aboutEyebrow">
            <input
              id="aboutEyebrow"
              type="text"
              className={f.control}
              value={about.eyebrow}
              onChange={(e) => update({ eyebrow: e.target.value })}
            />
          </FormField>

          <FormField label="Título" htmlFor="aboutTitle">
            <input
              id="aboutTitle"
              type="text"
              className={f.control}
              value={about.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </FormField>

          <FormField label="Biografía" htmlFor="aboutBio">
            <textarea
              id="aboutBio"
              rows={5}
              className={f.control}
              value={about.bio}
              onChange={(e) => update({ bio: e.target.value })}
            />
          </FormField>

          <FormField label="Descripción de la imagen" htmlFor="aboutImageCaption">
            <input
              id="aboutImageCaption"
              type="text"
              className={f.control}
              value={about.imageCaption}
              onChange={(e) => update({ imageCaption: e.target.value })}
            />
          </FormField>
        </div>
      )}
    </AdminLayout>
  );
}
