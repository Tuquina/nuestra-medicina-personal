import { useState } from 'react';
import { Button } from '../../../shared/components/Button/Button';
import { Dialog } from '../../../shared/components/Dialog/Dialog';
import type { PageContent } from '../../../shared/cms/types';
import type { EditablePageController } from '../../../shared/cms/useEditablePage';
import styles from './CmsEditorTools.module.css';

export function CmsEditorLoadState({ editor }: { editor: EditablePageController }) {
  if (editor.loadStatus === 'ready') return null;
  return (
    <div className={styles.loadState} role={editor.loadStatus === 'error' ? 'alert' : 'status'}>
      <p>{editor.loadStatus === 'loading' ? 'Cargando contenido…' : 'No pudimos cargar esta página del CMS.'}</p>
      {editor.loadStatus === 'error' && <Button variant="secondary" onClick={editor.retry}>Reintentar</Button>}
    </div>
  );
}

export function CmsEditorActions({
  editor,
  content,
  publicPath,
}: {
  editor: EditablePageController;
  content: PageContent;
  publicPath: string;
}) {
  const busy = editor.actionStatus !== null;
  const preview = async () => {
    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) previewWindow.opener = null;
    if (await editor.saveDraftNow(content)) {
      if (previewWindow) previewWindow.location.href = publicPath;
    } else {
      previewWindow?.close();
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <span className={[styles.status, editor.dirtySincePublish ? styles.unsaved : styles.published].join(' ')}>
          {editor.dirtySincePublish ? 'Cambios sin publicar' : 'Publicado'}
        </span>
        <div className={styles.actions}>
          <VersionHistoryButton editor={editor} />
          <Button variant="secondary" disabled={busy} onClick={preview}>Vista previa</Button>
          <Button variant="secondary" disabled={busy} onClick={() => editor.saveDraftNow(content)}>
            {editor.actionStatus === 'saving' ? 'Guardando…' : 'Guardar borrador'}
          </Button>
          <Button variant="primary" disabled={busy} onClick={editor.publish}>
            {editor.actionStatus === 'publishing' ? 'Publicando…' : 'Publicar'}
          </Button>
        </div>
      </div>
      {editor.message && <p className={styles.message} role="status">{editor.message}</p>}
    </div>
  );
}

export function VersionHistoryButton({
  editor,
  className,
}: {
  editor: EditablePageController;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const show = () => {
    setOpen(true);
    if (editor.versionsStatus === 'idle' || editor.versionsStatus === 'error') void editor.loadVersions();
  };
  const restore = async (versionId: string) => {
    if (await editor.restoreVersion(versionId)) setOpen(false);
  };

  return (
    <>
      <button type="button" className={className ?? styles.historyButton} disabled={editor.actionStatus !== null} onClick={show}>
        Versiones
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Historial de versiones"
        actions={<Button variant="secondary" onClick={() => setOpen(false)}>Cerrar</Button>}
      >
        {editor.versionsStatus === 'loading' ? <p>Cargando versiones…</p> : editor.versionsStatus === 'error' ? (
          <div><p>No pudimos cargar el historial.</p><Button variant="secondary" onClick={editor.loadVersions}>Reintentar</Button></div>
        ) : editor.versions.length === 0 ? <p>Todavía no hay versiones publicadas.</p> : (
          <div className={styles.versionList}>
            {editor.versions.map((version) => (
              <div key={version.id} className={styles.versionRow}>
                <div><strong>Versión {version.versionNumber}</strong><span>{new Date(version.createdAt).toLocaleString('es-AR')}</span></div>
                <Button variant="secondary" disabled={editor.actionStatus !== null} onClick={() => restore(version.id)}>Restaurar como borrador</Button>
              </div>
            ))}
          </div>
        )}
      </Dialog>
    </>
  );
}
