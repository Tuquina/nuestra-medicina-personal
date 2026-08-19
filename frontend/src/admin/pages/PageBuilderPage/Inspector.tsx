import type { BlockBg, BlockWidth, PageBlock } from './pageBuilderData';
import { BG_STYLES } from './pageBuilderData';
import styles from './PageBuilderPage.module.css';

const BG_OPTIONS: { value: BlockBg; label: string }[] = [
  { value: 'crema', label: 'Crema' },
  { value: 'cielo', label: 'Cielo' },
  { value: 'azul', label: 'Azul' },
];

interface InspectorProps {
  block: PageBlock | undefined;
  onChangeBg: (bg: BlockBg) => void;
  onChangeWidth: (width: BlockWidth) => void;
  onToggleVis: (axis: 'd' | 't' | 'm') => void;
}

/**
 * The selected block's settings — background/width/visibility are real;
 * alignment and top/bottom spacing render with their mockup defaults but
 * aren't wired to state, matching Admin Page Builder.dc.html exactly
 * (those two selects have no `onChange` in the source either — the
 * mockup itself scopes real editing to the properties above them).
 */
export function Inspector({ block, onChangeBg, onChangeWidth, onToggleVis }: InspectorProps) {
  if (!block) {
    return (
      <aside className={styles.inspector}>
        <p className={styles.emptyInspector}>Seleccioná un bloque en el lienzo para editar sus ajustes.</p>
      </aside>
    );
  }

  return (
    <aside className={styles.inspector}>
      <h2 className={styles.inspectorTitle}>{block.label}</h2>
      <p className={styles.inspectorSubtitle}>Bloque seleccionado</p>

      <p className={styles.inspectorSectionTitle}>Diseño</p>

      <label className={styles.fieldLabel} htmlFor="bg-swatches">
        Fondo
      </label>
      <div id="bg-swatches" className={styles.swatchRow}>
        {BG_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            aria-pressed={block.bg === option.value}
            onClick={() => onChangeBg(option.value)}
            className={[styles.swatch, block.bg === option.value ? styles.swatchActive : ''].join(' ')}
            style={{ background: BG_STYLES[option.value] }}
          />
        ))}
      </div>

      <label className={styles.fieldLabel} htmlFor="widthSelect">
        Ancho
      </label>
      <select
        id="widthSelect"
        className={styles.select}
        value={block.width}
        onChange={(e) => onChangeWidth(e.target.value as BlockWidth)}
      >
        <option value="normal">Normal</option>
        <option value="amplio">Amplio</option>
        <option value="completo">Pantalla completa</option>
      </select>

      <label className={styles.fieldLabel} htmlFor="alignSelect">
        Alineación
      </label>
      <select id="alignSelect" className={styles.select} defaultValue="Centro">
        <option>Izquierda</option>
        <option>Centro</option>
        <option>Derecha</option>
      </select>

      <div className={styles.spacingRow}>
        <div>
          <label className={styles.fieldLabel} htmlFor="spaceTop">
            Espaciado sup.
          </label>
          <select id="spaceTop" className={styles.select} defaultValue="Mediano">
            <option>Sin espacio</option>
            <option>Pequeño</option>
            <option>Mediano</option>
            <option>Grande</option>
            <option>Muy grande</option>
          </select>
        </div>
        <div>
          <label className={styles.fieldLabel} htmlFor="spaceBottom">
            Espaciado inf.
          </label>
          <select id="spaceBottom" className={styles.select} defaultValue="Mediano">
            <option>Sin espacio</option>
            <option>Pequeño</option>
            <option>Mediano</option>
            <option>Grande</option>
            <option>Muy grande</option>
          </select>
        </div>
      </div>

      <p className={[styles.inspectorSectionTitle, styles.inspectorSectionTitleSpaced].join(' ')}>Visibilidad</p>
      <div className={styles.visibilityList}>
        <label className={styles.visibilityLabel}>
          <input type="checkbox" checked={block.vis.d} onChange={() => onToggleVis('d')} /> Escritorio
        </label>
        <label className={styles.visibilityLabel}>
          <input type="checkbox" checked={block.vis.t} onChange={() => onToggleVis('t')} /> Tablet
        </label>
        <label className={styles.visibilityLabel}>
          <input type="checkbox" checked={block.vis.m} onChange={() => onToggleVis('m')} /> Móvil
        </label>
      </div>
    </aside>
  );
}
