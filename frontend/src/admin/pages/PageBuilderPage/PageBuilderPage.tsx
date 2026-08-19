import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { hardNavigate } from '../../../shared/utils/navigation';
import { BlockLibrary } from './BlockLibrary';
import { Canvas, type BuilderView } from './Canvas';
import { Inspector } from './Inspector';
import { INITIAL_BLOCKS, STATUS_LABEL, type BlockBg, type BlockWidth, type PageBlock, type PageStatus } from './pageBuilderData';
import styles from './PageBuilderPage.module.css';

const DEVICE_OPTIONS: { value: BuilderView; label: string }[] = [
  { value: 'desktop', label: 'Escritorio' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'mobile', label: 'Móvil' },
];

const statusClass: Record<PageStatus, string> = {
  published: styles.statusPublished,
  draft: styles.statusDraft,
  unsaved: styles.statusUnsaved,
};

/**
 * `/admin/paginas` — the visual block editor, built from
 * Admin Page Builder.dc.html. Reordering is arrow-button based (move
 * up/down), not drag-and-drop — that's what the mockup itself does, and
 * it sidesteps a whole class of accessibility/complexity problems a real
 * drag-and-drop implementation would add for no architecture.md
 * requirement backing it.
 *
 * This is a standalone full-screen editing surface, not wrapped in
 * AdminLayout — the source mockup deliberately drops the admin sidebar
 * here in favor of maximum canvas space, with its own "← Admin" escape
 * hatch in the dark toolbar instead.
 */
export function PageBuilderPage() {
  useDocumentTitle('Editor de páginas · Admin · Nuestra Medicina Personal');

  const [blocks, setBlocks] = useState<PageBlock[]>(INITIAL_BLOCKS);
  const [selectedId, setSelectedId] = useState<string | null>('hero');
  const [view, setView] = useState<BuilderView>('desktop');
  const [status, setStatus] = useState<PageStatus>('published');

  const markDirty = () => setStatus((prev) => (prev === 'unsaved' ? prev : 'unsaved'));

  const mutateBlock = (id: string, fn: (block: PageBlock) => PageBlock) => {
    setBlocks((prev) => prev.map((block) => (block.id === id ? fn({ ...block }) : block)));
    markDirty();
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    setBlocks((prev) => {
      const i = prev.findIndex((block) => block.id === id);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    markDirty();
  };

  const duplicateBlock = (id: string) => {
    setBlocks((prev) => {
      const i = prev.findIndex((block) => block.id === id);
      if (i === -1) return prev;
      const copy: PageBlock = { ...prev[i], id: `${id}-copy-${Date.now()}` };
      const next = [...prev];
      next.splice(i + 1, 0, copy);
      return next;
    });
    markDirty();
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((block) => block.id !== id));
    if (selectedId === id) setSelectedId(null);
    markDirty();
  };

  const addBlockType = (type: string) => {
    const id = `nuevo-${Date.now()}`;
    const newBlock: PageBlock = {
      id,
      type,
      label: type,
      bg: 'crema',
      width: 'normal',
      hidden: false,
      vis: { d: true, t: true, m: true },
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedId(id);
    markDirty();
  };

  const save = async (nextStatus: 'draft' | 'published') => {
    try {
      const url =
        nextStatus === 'published' ? '/api/v1/admin/pages/inicio/publish' : '/api/v1/admin/pages/inicio/draft';
      await fetch(url, {
        method: nextStatus === 'published' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      });
    } catch {
      // No backend yet.
    } finally {
      setStatus(nextStatus);
    }
  };

  const selected = blocks.find((block) => block.id === selectedId);

  return (
    <div className={styles.shell}>
      <header className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Link to="/admin" className={styles.backLink}>
            ← Admin
          </Link>
          <div className={styles.divider} />
          <span className={styles.pageLabel}>Página: Inicio</span>
          <span className={[styles.statusBadge, statusClass[status]].join(' ')}>{STATUS_LABEL[status]}</span>
        </div>

        <div className={styles.pillGroup}>
          <button type="button" className={styles.pillButtonDisabled} disabled>
            Deshacer
          </button>
          <button type="button" className={styles.pillButtonDisabled} disabled>
            Rehacer
          </button>
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
          <button type="button" className={styles.ghostButton} onClick={() => hardNavigate('/')}>
            Vista previa
          </button>
          <button
            type="button"
            className={[styles.ghostButton, styles.ghostButtonStrong].join(' ')}
            onClick={() => save('draft')}
          >
            Guardar borrador
          </button>
          <button type="button" className={styles.publishButton} onClick={() => save('published')}>
            Publicar
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <BlockLibrary onAdd={addBlockType} />

        <Canvas
          blocks={blocks}
          selectedId={selectedId}
          view={view}
          onSelect={setSelectedId}
          onMoveUp={(id) => moveBlock(id, -1)}
          onMoveDown={(id) => moveBlock(id, 1)}
          onDuplicate={duplicateBlock}
          onToggleHide={(id) => mutateBlock(id, (block) => ({ ...block, hidden: !block.hidden }))}
          onRemove={removeBlock}
        />

        <Inspector
          block={selected}
          onChangeBg={(bg: BlockBg) => selectedId && mutateBlock(selectedId, (block) => ({ ...block, bg }))}
          onChangeWidth={(width: BlockWidth) => selectedId && mutateBlock(selectedId, (block) => ({ ...block, width }))}
          onToggleVis={(axis) =>
            selectedId &&
            mutateBlock(selectedId, (block) => ({ ...block, vis: { ...block.vis, [axis]: !block.vis[axis] } }))
          }
        />
      </div>
    </div>
  );
}
