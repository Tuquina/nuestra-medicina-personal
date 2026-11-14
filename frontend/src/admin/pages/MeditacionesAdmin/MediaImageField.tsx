import { useRef, useState } from 'react';
import { Button } from '../../../shared/components/Button/Button';
import { Dialog } from '../../../shared/components/Dialog/Dialog';
import { apiRequest } from '../../../shared/api/client';
import { ADMIN_MEDIA_URL, mediaUrl } from '../../../shared/config/api';
import type { MediaAsset, MediaListResponse } from '../../media/types';
import styles from './MediaImageField.module.css';

interface MediaImageFieldProps {
  imageId: string | null;
  alt: string;
  onChange: (imageId: string | null) => void;
}

/**
 * Picks the image for a meditation: upload a new JPG/PNG (it lands in
 * Multimedia) or choose one already uploaded. Stores only the media id.
 */
export function MediaImageField({ imageId, alt, onChange }: MediaImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [library, setLibrary] = useState<MediaAsset[] | null>(null);
  const [libraryError, setLibraryError] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const asset = await apiRequest<MediaAsset>(ADMIN_MEDIA_URL, { method: 'POST', body });
      onChange(asset.id);
    } catch {
      setError('No pudimos subir la imagen. Usá un JPG o PNG de hasta 10 MB.');
    } finally {
      setUploading(false);
    }
  };

  const openLibrary = async () => {
    setLibraryOpen(true);
    setLibraryError(false);
    try {
      const response = await apiRequest<MediaListResponse>(ADMIN_MEDIA_URL);
      setLibrary(response.items);
    } catch {
      setLibraryError(true);
    }
  };

  return (
    <div className={styles.field}>
      <div className={styles.preview}>
        {imageId ? (
          <img src={mediaUrl(imageId)} alt={alt || 'Imagen de la meditación'} className={styles.image} />
        ) : (
          <span className={styles.empty}>Sin imagen</span>
        )}
      </div>
      <div className={styles.actions}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className={styles.hiddenInput}
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <Button variant="secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Subiendo…' : 'Subir imagen'}
        </Button>
        <Button variant="secondary" onClick={() => void openLibrary()} disabled={uploading}>
          Elegir de Multimedia
        </Button>
        {imageId && (
          <Button variant="secondary" onClick={() => onChange(null)} disabled={uploading}>
            Quitar
          </Button>
        )}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Dialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title="Elegir una imagen"
        actions={
          <Button variant="secondary" onClick={() => setLibraryOpen(false)}>
            Cerrar
          </Button>
        }
      >
        {libraryError ? (
          <p>No pudimos cargar la biblioteca de imágenes.</p>
        ) : library === null ? (
          <p>Cargando imágenes…</p>
        ) : library.length === 0 ? (
          <p>Todavía no hay imágenes. Subí una con “Subir imagen”.</p>
        ) : (
          <ul className={styles.grid}>
            {library.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  className={`${styles.option} ${asset.id === imageId ? styles.selected : ''}`}
                  onClick={() => {
                    onChange(asset.id);
                    setLibraryOpen(false);
                  }}
                  aria-label={`Usar ${asset.originalFilename}`}
                >
                  <img src={mediaUrl(asset.id)} alt="" loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </div>
  );
}
