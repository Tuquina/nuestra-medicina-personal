import type { CSSProperties } from 'react';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import styles from './CollectionHero.module.css';

interface CollectionHeroProps {
  eyebrow: string;
  eyebrowColor: string;
  glowColor: string;
  title: string;
  description: string;
}

/**
 * The gradient-text page-title hero used by Catálogo, Meditaciones and
 * Herramientas — same layout and glow position, recolored per
 * collection.
 */
export function CollectionHero({ eyebrow, eyebrowColor, glowColor, title, description }: CollectionHeroProps) {
  return (
    <section className={styles.section}>
      <div className={styles.glow} style={{ '--glow-color': glowColor } as CSSProperties} aria-hidden="true" />
      <div className={styles.inner}>
        <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>
        <h1 className={`${styles.title} gradient-text`}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </div>
    </section>
  );
}
