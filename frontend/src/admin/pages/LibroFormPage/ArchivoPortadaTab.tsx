import { useRef, useState } from 'react';
import { BookCover } from '../../../shared/components/BookCover/BookCover';
import { Button } from '../../../shared/components/Button/Button';
import { apiRequest, ApiError } from '../../../shared/api/client';
import { ADMIN_MEDIA_URL, adminBookEbookUrl } from '../../../shared/config/api';
import type { BookVariant, EbookUploadResponse } from '../../books/types';
import type { MediaAsset } from '../../media/types';
import styles from './ArchivoPortadaTab.module.css';

const VARIANT_ACCENT: Record<BookVariant, string> = {
  gold: 'color-mix(in oklch, var(--color-accent-gold) 50%, transparent)',
  blue: 'color-mix(in oklch, var(--color-sky) 60%, transparent)',
};

interface ArchivoPortadaTabProps {
  bookIdentifier: string | null;
  bookTitle: string;
  variant: BookVariant;
  coverMediaId: string | null;
  coverCaption: string;
  ebookFormat: string;
  ebookFileSizeBytes: number | null;
  onCoverUploaded: (asset: MediaAsset) => void;
  onCoverCaptionChange: (value: string) => void;
  onEbookUploaded: (upload: EbookUploadResponse) => void;
}

function fileSizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadError(error: unknown, kind: 'cover' | 'ebook'): string {
  if (error instanceof ApiError && error.status === 413) return 'El archivo supera el límite permitido.';
  if (error instanceof ApiError && error.status === 429) return 'Alcanzaste el límite de cargas. Esperá un minuto.';
  if (error instanceof ApiError && error.status === 422) {
    return kind === 'cover'
      ? 'Sólo se aceptan imágenes JPEG o PNG válidas.'
      : 'Sólo se aceptan archivos PDF o EPUB válidos.';
  }
  return 'No pudimos cargar el archivo. Intentá nuevamente.';
}

/** Uploads a cover to media and a protected eBook to the saved book. */
export function ArchivoPortadaTab({
  bookIdentifier,
  bookTitle,
  variant,
  coverMediaId,
  coverCaption,
  ebookFormat,
  ebookFileSizeBytes,
  onCoverUploaded,
  onCoverCaptionChange,
  onEbookUploaded,
}: ArchivoPortadaTabProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const ebookInputRef = useRef<HTMLInputElement>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [ebookUploading, setEbookUploading] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [ebookError, setEbookError] = useState<string | null>(null);
  const [ebookFileName, setEbookFileName] = useState<string | null>(null);

  const uploadCover = async (file: File | undefined) => {
    if (!file) return;
    setCoverUploading(true);
    setCoverError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const asset = await apiRequest<MediaAsset>(ADMIN_MEDIA_URL, { method: 'POST', body });
      onCoverUploaded(asset);
    } catch (error: unknown) {
      setCoverError(uploadError(error, 'cover'));
    } finally {
      setCoverUploading(false);
    }
  };

  const uploadEbook = async (file: File | undefined) => {
    if (!file || !bookIdentifier) return;
    setEbookUploading(true);
    setEbookError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const upload = await apiRequest<EbookUploadResponse>(adminBookEbookUrl(bookIdentifier), {
        method: 'PUT',
        body,
      });
      setEbookFileName(upload.filename);
      onEbookUploaded(upload);
    } catch (error: unknown) {
      setEbookError(uploadError(error, 'ebook'));
    } finally {
      setEbookUploading(false);
    }
  };

  return (
    <div className={styles.section}>
      <div>
        <p className={styles.sectionLabel}>Portada</p>
        <div className={styles.coverRow}>
          <BookCover
            className={styles.cover}
            mediaId={coverMediaId}
            title={bookTitle}
            accent={VARIANT_ACCENT[variant]}
            caption={coverCaption}
          />
          <div className={styles.coverControls}>
            <p className={styles.coverHint}>JPEG o PNG · proporción recomendada 2:3</p>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className={styles.fileInput}
              onChange={(event) => {
                void uploadCover(event.currentTarget.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            <Button variant="secondary" disabled={coverUploading} onClick={() => coverInputRef.current?.click()}>
              {coverUploading ? 'Subiendo…' : coverMediaId ? 'Reemplazar portada' : 'Subir portada'}
            </Button>
            <label className={styles.captionLabel} htmlFor="coverCaption">Descripción de portada</label>
            <input
              id="coverCaption"
              type="text"
              className={styles.captionInput}
              value={coverCaption}
              onChange={(event) => onCoverCaptionChange(event.target.value)}
            />
            {coverError && <p className={styles.error} role="alert">{coverError}</p>}
            {coverMediaId && <p className={styles.pendingSave}>La portada queda vinculada al guardar el libro.</p>}
          </div>
        </div>
      </div>

      <div>
        <p className={styles.sectionLabel}>Archivo del eBook</p>
        <div className={styles.fileCard}>
          <div>
            <p className={styles.fileName}>{ebookFileName ?? (ebookFileSizeBytes ? 'Archivo cargado' : 'Sin archivo')}</p>
            <p className={styles.fileMeta}>
              {ebookFileSizeBytes ? `${ebookFormat} · ${fileSizeLabel(ebookFileSizeBytes)}` : 'PDF o EPUB · máximo 50 MB'}
            </p>
          </div>
          <input
            ref={ebookInputRef}
            type="file"
            accept=".pdf,.epub,application/pdf,application/epub+zip"
            className={styles.fileInput}
            onChange={(event) => {
              void uploadEbook(event.currentTarget.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
          <button
            type="button"
            className={styles.linkButton}
            disabled={!bookIdentifier || ebookUploading}
            onClick={() => ebookInputRef.current?.click()}
          >
            {ebookUploading ? 'Subiendo…' : ebookFileSizeBytes ? 'Reemplazar' : 'Subir archivo'}
          </button>
        </div>
        {!bookIdentifier && <p className={styles.fileHint}>Guardá el libro antes de cargar el eBook.</p>}
        {ebookError && <p className={styles.error} role="alert">{ebookError}</p>}
      </div>
    </div>
  );
}
