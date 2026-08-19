import { Link } from 'react-router-dom';
import { SectionIntro } from '../../../shared/components/SectionIntro/SectionIntro';
import { ImagePlaceholder } from '../../../shared/components/ImagePlaceholder/ImagePlaceholder';
import styles from './CollectionTeaser.module.css';

interface CollectionTeaserProps {
  eyebrowColor: string;
  underlineEndColor: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
  imageAccent: string;
  imageCaption: string;
  /** Image on the left, text on the right (desktop only). */
  reverse?: boolean;
}

/**
 * The "collection preview" row used for both Meditaciones and
 * Herramientas on the home page — same shape, mirrored direction and
 * recolored per collection.
 */
export function CollectionTeaser({
  eyebrowColor,
  underlineEndColor,
  title,
  description,
  ctaLabel,
  ctaTo,
  imageAccent,
  imageCaption,
  reverse = false,
}: CollectionTeaserProps) {
  return (
    <div className={[styles.row, reverse ? styles.reverse : ''].join(' ')}>
      <div className={styles.textCol}>
        <SectionIntro
          eyebrow="Colección"
          eyebrowColor={eyebrowColor}
          underlineEndColor={underlineEndColor}
          title={title}
          maxWidth="420px"
        />
        <p className={styles.description}>{description}</p>
        <Link to={ctaTo} className={styles.link}>
          {ctaLabel} →
        </Link>
      </div>
      <div className={styles.imgCol}>
        <ImagePlaceholder accent={imageAccent} caption={imageCaption} aspectRatio="16 / 11" />
      </div>
    </div>
  );
}
