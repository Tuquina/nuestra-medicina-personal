import { ImagePlaceholder } from '../../../shared/components/ImagePlaceholder/ImagePlaceholder';
import type {
  DividerBlockProps,
  ImageBlockProps,
  QuoteBlockProps,
  SpacerBlockProps,
  TextBlockProps,
  TitleBlockProps,
} from '../../../shared/cms/homeContent';
import styles from './GenericBlocks.module.css';

/** The simple, free-standing blocks an admin can add from the Page
 * Builder's block palette (Título/Texto/Imagen/Cita/Separador/Espaciador)
 * — deliberately minimal, no per-block styling options beyond content. */

export function TitleBlock({ text }: TitleBlockProps) {
  return <h2 className={styles.title}>{text}</h2>;
}

export function TextBlock({ text }: TextBlockProps) {
  return <p className={styles.text}>{text}</p>;
}

export function ImageBlock({ caption }: ImageBlockProps) {
  return (
    <div className={styles.imageWrap}>
      <ImagePlaceholder accent="var(--color-sky-pale)" caption={caption} aspectRatio="16 / 9" borderRadius="8px" />
    </div>
  );
}

export function QuoteBlock({ text }: QuoteBlockProps) {
  return <p className={styles.quote}>“{text}”</p>;
}

export function DividerBlock(_props: DividerBlockProps) {
  return <hr className={styles.divider} />;
}

export function SpacerBlock({ height }: SpacerBlockProps) {
  const cls = height === 'lg' ? styles.spacerLg : height === 'sm' ? styles.spacerSm : styles.spacerMd;
  return <div className={cls} aria-hidden="true" />;
}
