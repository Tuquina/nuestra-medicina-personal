import { CmsImage } from '../CmsImage/CmsImage';
import styles from './ImageTextSection.module.css';

interface ImageTextSectionProps {
  heading: string;
  text: string;
  imageAccent: string;
  imageCaption: string;
  imageId?: string;
}

/** A simple image-left, text-right block (no eyebrow/CTA, unlike `About`). */
export function ImageTextSection({ heading, text, imageAccent, imageCaption, imageId }: ImageTextSectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.row}>
        <div className={styles.imgCol}>
          <CmsImage imageId={imageId} accent={imageAccent} caption={imageCaption} aspectRatio="4 / 5" />
        </div>
        <div className={styles.textCol}>
          <h2 className={styles.heading}>{heading}</h2>
          <p className={styles.text}>{text}</p>
        </div>
      </div>
    </section>
  );
}
