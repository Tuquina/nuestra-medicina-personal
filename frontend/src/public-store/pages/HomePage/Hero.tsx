import { Link } from 'react-router-dom';
import { Eyebrow } from '../../../shared/components/Eyebrow/Eyebrow';
import { ImagePlaceholder } from '../../../shared/components/ImagePlaceholder/ImagePlaceholder';
import type { HeroProps } from '../../../shared/cms/homeContent';
import styles from './Hero.module.css';

/** Internal link if the CTA target doesn't look like a hash/external URL. */
function CtaLink({ to, className, children }: { to: string; className: string; children: React.ReactNode }) {
  if (to.startsWith('#') || to.startsWith('http')) {
    return (
      <a href={to} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

export function Hero(props: HeroProps) {
  const {
    eyebrow,
    headingLine1,
    headingLine2,
    lede,
    primaryCtaLabel,
    primaryCtaTo,
    secondaryCtaLabel,
    secondaryCtaTo,
    imageCaption,
  } = props;

  return (
    <section className={styles.section}>
      <div className={styles.glow} aria-hidden="true" />

      <div className={styles.row}>
        <div className={styles.textCol}>
          <Eyebrow>{eyebrow}</Eyebrow>

          <h1 className={styles.heading}>
            <span className={styles.headingLine1}>{headingLine1}</span>
            <span className={`${styles.headingLine2} gradient-text`}>{headingLine2}</span>
          </h1>

          <p className={styles.lede}>{lede}</p>

          <div className={styles.ctaRow}>
            <CtaLink to={primaryCtaTo} className={styles.primaryCta}>
              {primaryCtaLabel}
            </CtaLink>
            <CtaLink to={secondaryCtaTo} className={styles.secondaryCta}>
              {secondaryCtaLabel}
            </CtaLink>
          </div>
        </div>

        <div className={styles.imgCol}>
          <ImagePlaceholder
            accent="var(--color-sky-pale)"
            caption={imageCaption}
            aspectRatio="4 / 5"
            borderRadius="8px"
          />
        </div>
      </div>
    </section>
  );
}
