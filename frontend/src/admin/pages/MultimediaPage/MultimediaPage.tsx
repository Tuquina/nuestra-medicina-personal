import { useRef, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { Dialog } from '../../../shared/components/Dialog/Dialog';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { stripedPlaceholder } from '../../../shared/utils/placeholderPattern';
import { MEDIA_ITEMS, THUMB_ACCENTS, type MediaItem } from '../../data/media';
import styles from './MultimediaPage.module.css';

const FILTERS = ['Todos', 'Imágenes', 'Portadas'] as const;
type Filter = (typeof FILTERS)[number];

function fileSizeLabel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** `/admin/multimedia` — the media library grid + metadata drawer, built from Admin Multimedia.dc.html. */
export function MultimediaPage() {
  useDocumentTitle('Multimedia · Admin · Nuestra Medicina Personal');

  const [items, setItems] = useState<MediaItem[]>(MEDIA_ITEMS);
  const [filter, setFilter] = useState<Filter>('Todos');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [altTextById, setAltTextById] = useState<Record<number, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter((item) => {
    const matchesFilter = filter === 'Todos' || item.category === filter;
    const matchesQuery = !query.trim() || item.name.toLowerCase().includes(query.trim().toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const selected = items.find((item) => item.id === selectedId);

  const handleUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const nextId = Math.max(0, ...items.map((item) => item.id)) + 1;
    const newItems: MediaItem[] = Array.from(files).map((file, index) => ({
      id: nextId + index,
      name: file.name,
      type: 'Imagen',
      category: 'Imágenes',
      dims: '—',
      sizeLabel: fileSizeLabel(file.size),
      dateLabel: 'Hoy',
      usedIn: '—',
      accent: THUMB_ACCENTS[(nextId + index) % THUMB_ACCENTS.length],
    }));
    // No object storage backend yet (architecture.md §16-17) — the files
    // themselves go nowhere, but the library reflects that an upload
    // happened rather than silently doing nothing.
    setItems((prev) => [...prev, ...newItems]);
  };

  const handleDelete = async () => {
    if (!selected) return;
    setConfirmDelete(false);
    setItems((prev) => prev.filter((item) => item.id !== selected.id));
    setSelectedId(null);
    try {
      await fetch(`/api/v1/admin/media/${selected.id}`, { method: 'DELETE' });
    } catch {
      // No backend yet.
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
            accept="image/*"
            multiple
            onChange={(e) => handleUpload(e.target.files)}
            style={{ display: 'none' }}
          />
          <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
            Subir archivos
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <main className={styles.main}>
          <div className={styles.toolbar}>
            <input
              type="text"
              placeholder="Buscar archivos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={styles.search}
              aria-label="Buscar archivos"
            />
            <div className={styles.filterRow}>
              {FILTERS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  className={[styles.filterButton, filter === option ? styles.filterButtonActive : ''].join(' ')}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 && query ? (
            <p className={styles.emptyState}>Ningún archivo coincide con "{query}".</p>
          ) : (
            <div className={styles.grid}>
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={[styles.tile, item.id === selectedId ? styles.tileSelected : ''].join(' ')}
                >
                  <div
                    className={styles.tileThumb}
                    style={{ background: stripedPlaceholder(item.accent) }}
                  />
                  <span className={styles.tileName}>{item.name}</span>
                </button>
              ))}
              <button type="button" className={styles.addTile} onClick={() => fileInputRef.current?.click()}>
                <span className={styles.addTilePlus} aria-hidden="true">
                  +
                </span>
                <span className="sr-only">Subir archivo</span>
              </button>
            </div>
          )}
        </main>

        <aside className={styles.drawer}>
          {selected ? (
            <>
              <div className={styles.drawerThumb} style={{ background: stripedPlaceholder(selected.accent) }} />
              <h2 className={styles.drawerTitle}>{selected.name}</h2>
              <div className={styles.drawerFields}>
                <div>
                  <p className={styles.drawerFieldLabel}>Tipo</p>
                  <p className={styles.drawerFieldValue}>{selected.type}</p>
                </div>
                <div>
                  <p className={styles.drawerFieldLabel}>Dimensiones</p>
                  <p className={styles.drawerFieldValue}>{selected.dims}</p>
                </div>
                <div>
                  <p className={styles.drawerFieldLabel}>Peso</p>
                  <p className={styles.drawerFieldValue}>{selected.sizeLabel}</p>
                </div>
                <div>
                  <p className={styles.drawerFieldLabel}>Fecha</p>
                  <p className={styles.drawerFieldValue}>{selected.dateLabel}</p>
                </div>
                <div>
                  <p className={styles.drawerFieldLabel}>Usado en</p>
                  <p className={styles.drawerFieldValue}>{selected.usedIn}</p>
                </div>
                <div>
                  <label htmlFor="altText" className={styles.altLabel}>
                    Texto alternativo
                  </label>
                  <textarea
                    id="altText"
                    rows={3}
                    placeholder="Describí brevemente la imagen para personas que utilizan lectores de pantalla."
                    className={styles.altTextarea}
                    value={altTextById[selected.id] ?? ''}
                    onChange={(e) => setAltTextById((prev) => ({ ...prev, [selected.id]: e.target.value }))}
                  />
                </div>
              </div>
              <Button
                variant="danger"
                fullWidth
                className={styles.deleteButton}
                onClick={() => setConfirmDelete(true)}
              >
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
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Eliminar
            </Button>
          </>
        }
      >
        {selected?.usedIn && selected.usedIn !== '—'
          ? `Este archivo está en uso (${selected.usedIn}). Eliminarlo puede afectar esa página.`
          : 'Esta acción no se puede deshacer.'}
      </Dialog>
    </AdminLayout>
  );
}
