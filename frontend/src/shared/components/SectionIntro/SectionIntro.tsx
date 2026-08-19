import type { CSSProperties, ReactNode } from 'react';
import { Eyebrow } from '../Eyebrow/Eyebrow';
import styles from './SectionIntro.module.css';

interface SectionIntroProps {
  eyebrow: ReactNode;
  eyebrowColor?: string;
  title: ReactNode;
  description?: ReactNode;
  /** End color of the underline gradient (start is always the brand deep blue). */
  underlineEndColor?: string;
  maxWidth?: string;
  className?: string;
}

/**
 * The repeated "eyebrow → heading → gradient underline → description"
 * pattern used to introduce most content sections across the site.
 */
export function SectionIntro({
  eyebrow,
  eyebrowColor,
  title,
  description,
  underlineEndColor,
  maxWidth,
  className,
}: SectionIntroProps) {
  const style = maxWidth ? ({ '--intro-max-width': maxWidth } as CSSProperties) : undefined;
  const underlineStyle = underlineEndColor
    ? ({ '--underline-end': underlineEndColor } as CSSProperties)
    : undefined;

  return (
    <div className={[styles.intro, className].filter(Boolean).join(' ')} style={style}>
      <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.underline} style={underlineStyle} aria-hidden="true" />
      {description && <p className={styles.description}>{description}</p>}
    </div>
  );
}
