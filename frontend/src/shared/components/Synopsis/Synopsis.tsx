import { Eyebrow } from '../Eyebrow/Eyebrow';
import styles from './Synopsis.module.css';

interface SynopsisProps {
  eyebrowColor: string;
  paragraphs: string[];
}

export function Synopsis({ eyebrowColor, paragraphs }: SynopsisProps) {
  return (
    <section className={styles.section}>
      <div className={styles.eyebrow}>
        <Eyebrow color={eyebrowColor}>Sinopsis</Eyebrow>
      </div>
      {paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 24)} className={styles.paragraph}>
          {paragraph}
        </p>
      ))}
    </section>
  );
}
