import { useRef, useState } from 'react';
import { ImagePlaceholder } from '../../../shared/components/ImagePlaceholder/ImagePlaceholder';
import { Button } from '../../../shared/components/Button/Button';
import type { Book } from '../../../public-store/data/books';
import styles from './ArchivoPortadaTab.module.css';

const VARIANT_ACCENT: Record<Book['variant'], string> = {
  gold: 'color-mix(in oklch, var(--color-accent-gold) 50%, transparent)',
  blue: 'color-mix(in oklch, var(--color-sky) 60%, transparent)',
};

interface ArchivoPortadaTabProps {
  variant: Book['variant'];
  coverCaption: string;
  ebookFileName: string;
  ebookFileMeta: string;
}

/**
 * Cover + eBook file management. The backend endpoints exist, but this
 * prototype still only opens a file picker; transport is wired in the final
 * integration phase.
 */
export function ArchivoPortadaTab({ variant, coverCaption, ebookFileName, ebookFileMeta }: ArchivoPortadaTabProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const ebookInputRef = useRef<HTMLInputElement>(null);
  const [pendingCoverName, setPendingCoverName] = useState<string | null>(null);
  const [pendingEbook, setPendingEbook] = useState<{ name: string; meta: string } | null>(null);

  return (
    <div className={styles.section}>
      <div>
        <p className={styles.sectionLabel}>Portada</p>
        <div className={styles.coverRow}>
          <ImagePlaceholder
            className={styles.cover}
            accent={VARIANT_ACCENT[variant]}
            alt={pendingCoverName ?? coverCaption}
            aspectRatio="2 / 3"
            borderRadius="4px"
          />
          <div>
            <p className={styles.coverHint}>
              {pendingCoverName ? `Seleccionada: ${pendingCoverName}` : 'Proporción recomendada: 2:3'}
            </p>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setPendingCoverName(e.target.files?.[0]?.name ?? null)}
              style={{ display: 'none' }}
            />
            <Button variant="secondary" onClick={() => coverInputRef.current?.click()}>
              Reemplazar portada
            </Button>
          </div>
        </div>
      </div>

      <div>
        <p className={styles.sectionLabel}>Archivo del eBook</p>
        <div className={styles.fileCard}>
          <div>
            <p className={styles.fileName}>{pendingEbook?.name ?? ebookFileName}</p>
            <p className={styles.fileMeta}>{pendingEbook?.meta ?? ebookFileMeta}</p>
          </div>
          <input
            ref={ebookInputRef}
            type="file"
            accept=".pdf,.epub"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
              setPendingEbook({ name: file.name, meta: `${sizeMb} MB` });
            }}
            style={{ display: 'none' }}
          />
          <button type="button" className={styles.linkButton} onClick={() => ebookInputRef.current?.click()}>
            Reemplazar
          </button>
        </div>
      </div>
    </div>
  );
}
