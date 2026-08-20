import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { Dialog } from '../../../shared/components/Dialog/Dialog';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { apiRequest, ApiError } from '../../../shared/api/client';
import { ADMIN_MEDIA_URL, adminMediaUrl } from '../../../shared/config/api';
import type { MediaAsset, MediaListResponse } from '../../media/types';
import styles from './MultimediaPage.module.css';

type MediaState =
  | { status: 'loading' }
  | { status: 'ready'; items: MediaAsset[] }
  | { status: 'error' };

function fileSizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

/** `/admin/multimedia` — real media metadata and image files from the backend. */
export function MultimediaPage() {
  useDocumentTitle('Multimedia · Admin · Nuestra Medicina Personal');

  const [state, setState] = useState<MediaState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<MediaListResponse>(ADMIN_MEDIA_URL, { signal: controller.signal })
      .then((response) => setState({ status: 'ready', items: response.items }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [attempt]);

  const items = state.status === 'ready' ? state.items : [];
  const filtered = items.filter((item) =>
    item.originalFilename.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const selected = items.find((item) => item.id === selectedId);

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setActionError(null);
    try {
      const uploaded = await Promise.all(
        files.map((file) => {
          const body = new FormData();
          body.append('file', file);
          return apiRequest<MediaAsset>(ADMIN_MEDIA_URL, { method: 'POST', body });
        }),
      );
      setState((current) =>
        current.status === 'ready'
          ? { status: 'ready', items: [...uploaded, ...current.items] }
          : { status: 'ready', items: uploaded },
      );
      setSelectedId(uploaded[0]?.id ?? null);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 413) {
        setActionError('La imagen supera el límite permitido.');
      } else if (error instanceof ApiError && error.status === 422) {
        setActionError('Sólo se aceptan imágenes JPEG o PNG válidas.');
      } else if (error instanceof ApiError && error.status === 429) {
        setActionError('Alcanzaste el límite de cargas. Esperá un minuto y reintentá.');
      } else {
        setActionError('No pudimos subir los archivos. Intentá nuevamente.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setConfirmDelete(false);
    setActionError(null);
    try {
      await apiRequest<void>(adminMediaUrl(selected.id), { method: 'DELETE' });
      setState((current) =>
        current.status === 'ready'
          ? { status: 'ready', items: current.items.filter((item) => item.id !== selected.id) }
          : current,
      );
      setSelectedId(null);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'MEDIA_IN_USE') {
        setActionError('Este archivo está siendo utilizado y no se puede eliminar.');
      } else if (error instanceof ApiError && error.status === 429) {
        setActionError('Alcanzaste el límite de operaciones. Esperá un minuto y reintentá.');
      } else {
        setActionError('No pudimos eliminar el archivo. Intentá nuevamente.');
      }
    }
  };

  return (
    <AdminLayout
      title="Multimedia"
      headerActions={
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            className={styles.fileInput}
            onChange={(event) => {
              void handleUpload(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = '';
            }}
          />
          <Button variant="primary" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? 'Subiendo…' : 'Subir archivos'}
          </Button>
        </>
      }
    >
      {actionError && <p className={styles.actionError} role="alert">{actionError}</p>}
      <div className={styles.body}>
        <main className={styles.main}>
          <div className={styles.toolbar}>
            <input
              type="text"
              placeholder="Buscar archivos..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={styles.search}
              aria-label="Buscar archivos"
            />
          </div>

          {state.status === 'loading' ? (
            <p className={styles.emptyState} role="status">Cargando archivos…</p>
          ) : state.status === 'error' ? (
            <div className={styles.emptyState} role="alert">
              <p>No pudimos cargar la biblioteca multimedia.</p>
              <Button variant="secondary" onClick={retry}>Reintentar</Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className={styles.emptyState}>
              {query ? `Ningún archivo coincide con “${query}”.` : 'Todavía no hay archivos multimedia.'}
            </p>
          ) : (
            <div className={styles.grid}>
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={[styles.tile, item.id === selectedId ? styles.tileSelected : ''].join(' ')}
                >
                  <img className={styles.tileThumb} src={item.url} alt="" loading="lazy" />
                  <span className={styles.tileName}>{item.originalFilename}</span>
                </button>
              ))}
              <button type="button" className={styles.addTile} onClick={() => fileInputRef.current?.click()}>
                <span className={styles.addTilePlus} aria-hidden="true">+</span>
                <span className="sr-only">Subir archivo</span>
              </button>
            </div>
          )}
        </main>

        <aside className={styles.drawer}>
          {selected ? (
            <>
              <img className={styles.drawerThumb} src={selected.url} alt="" />
              <h2 className={styles.drawerTitle}>{selected.originalFilename}</h2>
              <div className={styles.drawerFields}>
                <div>
                  <p className={styles.drawerFieldLabel}>Tipo</p>
                  <p className={styles.drawerFieldValue}>{selected.mimeType}</p>
                </div>
                <div>
                  <p className={styles.drawerFieldLabel}>Dimensiones</p>
                  <p className={styles.drawerFieldValue}>{selected.width} × {selected.height} px</p>
                </div>
                <div>
                  <p className={styles.drawerFieldLabel}>Peso</p>
                  <p className={styles.drawerFieldValue}>{fileSizeLabel(selected.sizeBytes)}</p>
                </div>
                <div>
                  <p className={styles.drawerFieldLabel}>Fecha</p>
                  <p className={styles.drawerFieldValue}>{dateLabel(selected.createdAt)}</p>
                </div>
              </div>
              <Button variant="danger" fullWidth className={styles.deleteButton} onClick={() => setConfirmDelete(true)}>
                Eliminar archivo
              </Button>
            </>
          ) : (
            <p className={styles.drawerEmpty}>Seleccioná un archivo para ver sus datos.</p>
          )}
        </aside>
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="¿Eliminar este archivo?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
          </>
        }
      >
        El servidor rechazará la operación si una portada o página todavía utiliza esta imagen.
      </Dialog>
    </AdminLayout>
  );
}
