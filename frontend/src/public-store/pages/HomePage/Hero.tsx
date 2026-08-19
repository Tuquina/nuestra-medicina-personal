import { Link } from 'react-router-dom';
import { Eyebrow } from '../../../shared/components/Eyebrow/Eyebrow';
import { ImagePlaceholder } from '../../../shared/components/ImagePlaceholder/ImagePlaceholder';
import styles from './Hero.module.css';

export function Hero() {
  return (
    <section className={styles.section}>
      <div className={styles.glow} aria-hidden="true" />

      <div className={styles.row}>
        <div className={styles.textCol}>
          <Eyebrow>Escritura · Reflexión · Herramientas personales</Eyebrow>

          <h1 className={styles.heading}>
            <span className={styles.headingLine1}>Nuestra</span>
            <span className={styles.headingLine2}>medicina personal</span>
          </h1>

          <p className={styles.lede}>
            Un espacio para escribir, mirar hacia adentro y encontrarnos con
            nuestras propias herramientas.
          </p>

          <div className={styles.ctaRow}>
            <Link to="/libros" className={styles.primaryCta}>
              Explorar los libros
            </Link>
            <a href="#sobre-el-proyecto" className={styles.secondaryCta}>
              Conocer el proyecto →
            </a>
          </div>
        </div>

        <div className={styles.imgCol}>
          <ImagePlaceholder
            accent="var(--color-sky-pale)"
            caption="Foto — amanecer sobre paisaje natural"
            aspectRatio="4 / 5"
            borderRadius="8px"
          />
        </div>
      </div>
    </section>
  );
}
