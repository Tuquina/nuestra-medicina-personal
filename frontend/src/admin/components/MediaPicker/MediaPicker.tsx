import { useEffect, useId, useRef, useState } from 'react';
import { apiRequest, ApiError } from '../../../shared/api/client';
import { ADMIN_MEDIA_URL, mediaUrl } from '../../../shared/config/api';
import type { MediaAsset, MediaListResponse } from '../../media/types';
import styles from './MediaPicker.module.css';

interface MediaPickerProps {
  label?: string;
  value?: string;
  onChange: (imageId: string) => void;
}

/** Uploads persist immediately; selecting one only changes the current draft. */
export function MediaPicker({ label = 'Imagen', value, onChange }: MediaPickerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    const controller = new AbortController();
    apiRequest<MediaListResponse>(ADMIN_MEDIA_URL, { signal: controller.signal })
      .then(({ items: loaded }) => setItems(loaded))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof ApiError && err.status === 403
          ? 'Necesitás permisos de administración.' : 'No pudimos cargar las imágenes. Reintentá.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, attempt]);

  const close = () => { dialog.current?.close(); setOpen(false); };
  const upload = async (file: File) => {
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Elegí una imagen JPEG o PNG.'); return;
    }
    setUploading(true); setError('');
    try {
      const body = new FormData(); body.append('file', file);
      const asset = await apiRequest<MediaAsset>(ADMIN_MEDIA_URL, { method: 'POST', body });
      setItems((current) => [asset, ...current]);
      onChange(asset.id); close();
    } catch (err: unknown) {
      setError(err instanceof ApiError && err.status === 413 ? 'La imagen supera el tamaño permitido.'
        : err instanceof ApiError && err.status === 429 ? 'Esperá un minuto antes de volver a subir una imagen.'
          : 'No pudimos subir la imagen. Revisá que sea un JPEG o PNG válido y reintentá.');
    } finally { setUploading(false); }
  };

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      {value && <img className={styles.preview} src={mediaUrl(value)} alt="Imagen seleccionada" />}
      <div className={styles.actions}>
        <button type="button" onClick={() => { setError(''); setQuery(''); setLoading(true); setOpen(true); }}>
          {value ? 'Cambiar imagen' : 'Elegir imagen'}
        </button>
        {value && <button type="button" onClick={() => onChange('')}>Quitar imagen</button>}
      </div>
      <dialog ref={dialog} className={styles.dialog} aria-labelledby={headingId}
        onCancel={(event) => { if (uploading) event.preventDefault(); }}
        onClose={() => setOpen(false)}>
        <div className={styles.header}>
          <h2 id={headingId}>Elegir imagen</h2>
          <button type="button" disabled={uploading} onClick={close}>Cerrar</button>
        </div>
        <p>Elegí una imagen de Multimedia o subí una nueva. Se mostrará en el sitio cuando publiques la página.</p>
        <label className={styles.upload}>Subir imagen (JPEG o PNG)
          <input type="file" accept="image/jpeg,image/png" disabled={uploading || loading}
            onChange={(event) => {
              const file = event.target.files?.[0]; event.target.value = '';
              if (file) void upload(file);
            }} />
        </label>
        <input className={styles.search} type="search" aria-label="Buscar imagen" placeholder="Buscar por nombre"
          value={query} onChange={(event) => setQuery(event.target.value)} />
        {error && <div role="alert">{error} <button type="button" disabled={uploading} onClick={() => {
          setError(''); setLoading(true); setAttempt((n) => n + 1);
        }}>Reintentar</button></div>}
        {(loading || uploading) && <p role="status">{uploading ? 'Subiendo imagen…' : 'Cargando imágenes…'}</p>}
        {!loading && !error && items.length === 0 && <p>Todavía no hay imágenes. Podés subir la primera.</p>}
        {!loading && items.length > 0 && !items.some((item) => item.originalFilename.toLocaleLowerCase().includes(query.toLocaleLowerCase())) && <p>No hay imágenes con ese nombre.</p>}
        <div className={styles.grid}>
          {items.filter((item) => item.originalFilename.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((item) => (
            <button key={item.id} type="button" disabled={loading || uploading} aria-pressed={value === item.id}
              onClick={() => { onChange(item.id); close(); }}>
              <img src={mediaUrl(item.id)} alt="" loading="lazy" />
              <span>{item.originalFilename}</span>
            </button>
          ))}
        </div>
      </dialog>
    </div>
  );
}
