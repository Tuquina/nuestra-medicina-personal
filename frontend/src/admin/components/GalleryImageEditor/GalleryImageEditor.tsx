import { MediaPicker } from '../MediaPicker/MediaPicker';
import type { GalleryProps } from '../../../shared/cms/homeContent';
import styles from './GalleryImageEditor.module.css';

export function GalleryImageEditor({ captions, imageIds = [], onChange }: GalleryProps & {
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const entries = captions.map((caption, index) => ({ caption, imageId: imageIds[index] ?? '' }));
  const save = (next: typeof entries) => onChange({ captions: next.map((item) => item.caption), imageIds: next.map((item) => item.imageId) });
  const move = (index: number, direction: number) => {
    const next = [...entries];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    save(next);
  };
  return <div className={styles.editor}>
    {entries.map((entry, index) => <fieldset key={index} className={styles.item}>
      <legend>Foto {index + 1}</legend>
      <MediaPicker value={entry.imageId} onChange={(imageId) => save(entries.map((item, i) => i === index ? { ...item, imageId } : item))} />
      <label>Descripción de la foto {index + 1}
        <input value={entry.caption} maxLength={300}
          onChange={(event) => save(entries.map((item, i) => i === index ? { ...item, caption: event.target.value } : item))} />
      </label>
      <div className={styles.actions}>
        <button type="button" disabled={index === 0} aria-label={`Subir foto ${index + 1}`} onClick={() => move(index, -1)}>↑</button>
        <button type="button" disabled={index === entries.length - 1} aria-label={`Bajar foto ${index + 1}`} onClick={() => move(index, 1)}>↓</button>
        <button type="button" disabled={entries.length <= 1} onClick={() => save(entries.filter((_, i) => i !== index))}>Quitar foto {index + 1}</button>
      </div>
    </fieldset>)}
    <button type="button" disabled={entries.length >= 20} onClick={() => save([...entries, { caption: 'Nueva imagen', imageId: '' }])}>Agregar foto</button>
  </div>;
}
