import { Link } from 'react-router-dom';
import { SectionIntro } from '../../../shared/components/SectionIntro/SectionIntro';
import { CmsImage } from '../../../shared/components/CmsImage/CmsImage';
import type { CollectionTeaserProps } from '../../../shared/cms/homeContent';
import styles from './CollectionTeaser.module.css';

/** The two color moods available for a collection teaser — kept as a
 * small fixed choice (not a raw color picker) per architecture.md §12's
 * "preferir opciones predefinidas frente a permitir CSS arbitrario". */
const ACCENTS = {
  sky: {
    eyebrowColor: 'var(--color-sky)',
    underlineEndColor: 'var(--color-sky)',
    imageAccent: 'var(--color-sky-pale)',
  },
  amber: {
    eyebrowColor: 'var(--color-accent-gold)',
    underlineEndColor: 'var(--color-accent-amber)',
    imageAccent: 'color-mix(in oklch, var(--color-accent-gold) 45%, transparent)',
  },
};

/**
 * The "collection preview" row used for both Meditaciones and
 * Herramientas on the home page — same shape, mirrored direction and
 * recolored per collection.
 */
export function CollectionTeaser({
  eyebrow,
  title,
  description,
  ctaLabel,
  ctaTo,
  imageCaption,
  imageId,
  reverse,
  accent,
}: CollectionTeaserProps) {
  const colors = ACCENTS[accent] ?? ACCENTS.sky;

  return (
    <div className={[styles.row, reverse ? styles.reverse : ''].join(' ')}>
      <div className={styles.textCol}>
        <SectionIntro
          eyebrow={eyebrow}
          eyebrowColor={colors.eyebrowColor}
          underlineEndColor={colors.underlineEndColor}
          title={title}
          maxWidth="420px"
        />
        <p className={styles.description}>{description}</p>
        <Link to={ctaTo} className={styles.link}>
          {ctaLabel} →
        </Link>
      </div>
      <Link to={ctaTo} className={styles.imgCol} aria-label={ctaLabel}>
        <CmsImage imageId={imageId} accent={colors.imageAccent} caption={imageCaption} aspectRatio="16 / 11" />
      </Link>
    </div>
  );
}
