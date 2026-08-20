import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { hardNavigate } from '../../../shared/utils/navigation';
import { Dialog } from '../../../shared/components/Dialog/Dialog';
import { Button } from '../../../shared/components/Button/Button';
import { useEditablePage } from '../../../shared/cms/useEditablePage';
import { CmsEditorLoadState, VersionHistoryButton } from '../../components/CmsEditorTools/CmsEditorTools';
import { buildHomeSeedContent } from '../../../shared/cms/homeContent';
import { HOME_SLUG, type Section } from '../../../shared/cms/types';
import { BlockLibrary } from './BlockLibrary';
import { Canvas, type BuilderView } from './Canvas';
import { Inspector } from './Inspector';
import { defaultPropsFor } from './sectionSchemas';
import styles from './PageBuilderPage.module.css';

const DEVICE_OPTIONS: { value: BuilderView; label: string }[] = [
  { value: 'desktop', label: 'Escritorio' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'mobile', label: 'Móvil' },
];

/**
 * `/admin/paginas` — the visual block editor for the Home page.
 *
 * Reordering is arrow-button based (move up/down), not drag-and-drop —
 * that's what the source mockup does, and it sidesteps a whole class of
 * accessibility/complexity problems a real drag-and-drop implementation
 * would add for no architecture.md requirement backing it.
 *
 * Content is read from and written to the authenticated `pages` API through
 * `shared/cms` — every field here maps to a real
 * prop the public Home page renders (see Canvas.tsx's live preview and
 * shared/cms/homeContent.ts), so there's no gap between "lo que edito acá"
 * and "lo que se ve en el sitio" (per the explicit brief on this feature).
 *
 * This is a standalone full-screen editing surface, not wrapped in
 * AdminLayout — the source mockup deliberately drops the admin sidebar
 * here in favor of maximum canvas space, with its own "← Admin" escape
 * hatch in the dark toolbar instead.
 */
export function PageBuilderPage() {
  useDocumentTitle('Editor de páginas · Admin · Nuestra Medicina Personal');

  const editor = useEditablePage({
    type: 'HOME',
    slug: HOME_SLUG,
    title: 'Inicio',
    seed: buildHomeSeedContent,
  });
  const { content, setContent, saveDraftNow, publish, dirtySincePublish } = editor;
  const sections = content.sections;

  const [selectedId, setSelectedId] = useState<string | null>(sections[0]?.id ?? null);
  const [view, setView] = useState<BuilderView>('desktop');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<'draft' | 'published' | null>(null);

  const updateSections = (next: Section[]) => {
    setContent({ ...content, sections: next });
  };

  const mutateSection = (id: string, fn: (section: Section) => Section) => {
    updateSections(sections.map((section) => (section.id === id ? fn({ ...section }) : section)));
  };

  const moveSection = (id: string, dir: -1 | 1) => {
    const i = sections.findIndex((section) => section.id === id);
    const j = i + dir;
    if (i === -1 || j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    updateSections(next);
  };

  const duplicateSection = (id: string) => {
    const i = sections.findIndex((section) => section.id === id);
    if (i === -1) return;
    const copy: Section = { ...sections[i], id: `${sections[i].type}-${Date.now()}` };
    const next = [...sections];
    next.splice(i + 1, 0, copy);
    updateSections(next);
    setSelectedId(copy.id);
  };

  const requestRemove = (id: string) => setPendingDeleteId(id);

  const confirmRemove = () => {
    if (!pendingDeleteId) return;
    updateSections(sections.filter((section) => section.id !== pendingDeleteId));
    if (selectedId === pendingDeleteId) setSelectedId(null);
    setPendingDeleteId(null);
  };

  const addBlockType = (type: string) => {
    const id = `${type}-${Date.now()}`;
    const newSection: Section = { id, type, props: defaultPropsFor(type), hidden: false };
    updateSections([...sections, newSection]);
    setSelectedId(id);
  };

  const flashSaved = (kind: 'draft' | 'published') => {
    setJustSaved(kind);
    window.setTimeout(() => setJustSaved(null), 2500);
  };

  const selected = sections.find((section) => section.id === selectedId);

  if (editor.loadStatus !== 'ready') {
    return <div className={styles.shell}><CmsEditorLoadState editor={editor} /></div>;
  }

  const busy = editor.actionStatus !== null;

  return (
    <div className={styles.shell}>
      <header className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Link to="/admin" className={styles.backLink}>
            ← Admin
          </Link>
          <div className={styles.divider} />
          <span className={styles.pageLabel}>Página: Inicio</span>
          <span
            className={[styles.statusBadge, dirtySincePublish ? styles.statusUnsaved : styles.statusPublished].join(' ')}
          >
            {justSaved === 'published'
              ? 'Publicado ✓'
              : justSaved === 'draft'
                ? 'Borrador guardado ✓'
                : dirtySincePublish
                  ? 'Cambios sin publicar'
                  : 'Publicado'}
          </span>
        </div>

        <div className={styles.pillGroup}>
          {DEVICE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setView(option.value)}
              className={[styles.deviceButton, view === option.value ? styles.deviceButtonActive : ''].join(' ')}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className={styles.toolbarRight}>
          <VersionHistoryButton editor={editor} className={styles.ghostButton} />
          <button
            type="button"
            className={styles.ghostButton}
            title="Ver los cambios sin publicar en el sitio real"
            disabled={busy}
            onClick={async () => {
              if (await saveDraftNow(content)) hardNavigate('/?preview=1');
            }}
          >
            Vista previa
          </button>
          <button
            type="button"
            className={[styles.ghostButton, styles.ghostButtonStrong].join(' ')}
            disabled={busy}
            onClick={async () => {
              if (await saveDraftNow(content)) flashSaved('draft');
            }}
          >
            {editor.actionStatus === 'saving' ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button
            type="button"
            className={styles.publishButton}
            disabled={busy}
            onClick={async () => {
              if (await publish()) flashSaved('published');
            }}
          >
            {editor.actionStatus === 'publishing' ? 'Publicando…' : 'Publicar'}
          </button>
        </div>
      </header>

      {editor.message && <p className={styles.editorMessage} role="status">{editor.message}</p>}

      <div className={styles.body}>
        <BlockLibrary onAdd={addBlockType} />

        <Canvas
          sections={sections}
          selectedId={selectedId}
          view={view}
          onSelect={setSelectedId}
          onMoveUp={(id) => moveSection(id, -1)}
          onMoveDown={(id) => moveSection(id, 1)}
          onDuplicate={duplicateSection}
          onToggleHide={(id) => mutateSection(id, (section) => ({ ...section, hidden: !section.hidden }))}
          onRemove={requestRemove}
        />

        <Inspector
          section={selected}
          onChangeProp={(key, value) =>
            selectedId && mutateSection(selectedId, (section) => ({ ...section, props: { ...section.props, [key]: value } }))
          }
          onToggleHidden={() =>
            selectedId && mutateSection(selectedId, (section) => ({ ...section, hidden: !section.hidden }))
          }
        />
      </div>

      <Dialog
        open={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        title="¿Eliminar este bloque?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmRemove}>
              Eliminar
            </Button>
          </>
        }
      >
        Esta acción no se puede deshacer. El bloque se va a quitar del borrador
        de la página de Inicio.
      </Dialog>
    </div>
  );
}
