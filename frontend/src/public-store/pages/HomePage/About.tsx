import { SectionIntro } from '../../../shared/components/SectionIntro/SectionIntro';
import { ImagePlaceholder } from '../../../shared/components/ImagePlaceholder/ImagePlaceholder';
import type { AboutProps } from '../../../shared/cms/homeContent';
import styles from './About.module.css';

export function About({ eyebrow, title, bio, imageCaption }: AboutProps) {
  return (
    <section id="sobre-el-proyecto" className={styles.section}>
      <div className={styles.row}>
        <div className={styles.imgCol}>
          <div className={styles.glow} aria-hidden="true" />
          <ImagePlaceholder
            className={styles.photo}
            accent="color-mix(in oklch, var(--color-accent-gold) 50%, transparent)"
            caption={imageCaption}
          />
        </div>
        <div className={styles.textCol}>
          <SectionIntro eyebrow={eyebrow} title={title} maxWidth="460px" />
          <p className={styles.bio}>{bio}</p>
        </div>
      </div>
    </section>
  );
}
