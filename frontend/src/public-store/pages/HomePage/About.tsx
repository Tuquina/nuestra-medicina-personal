import { SectionIntro } from '../../../shared/components/SectionIntro/SectionIntro';
import { ImagePlaceholder } from '../../../shared/components/ImagePlaceholder/ImagePlaceholder';
import styles from './About.module.css';

export function About() {
  return (
    <section id="sobre-el-proyecto" className={styles.section}>
      <div className={styles.row}>
        <div className={styles.imgCol}>
          <div className={styles.glow} aria-hidden="true" />
          <ImagePlaceholder
            className={styles.photo}
            accent="color-mix(in oklch, var(--color-accent-gold) 50%, transparent)"
            caption="Foto — retrato del autor/a"
          />
        </div>
        <div className={styles.textCol}>
          <SectionIntro
            eyebrow="Sobre el proyecto"
            title="Quién escribe estas páginas"
            maxWidth="460px"
          />
          <p className={styles.bio}>
            Nombre del autor/a — breve biografía editable sobre su recorrido
            en la escritura, la educación y el acompañamiento de procesos
            personales.
          </p>
        </div>
      </div>
    </section>
  );
}
