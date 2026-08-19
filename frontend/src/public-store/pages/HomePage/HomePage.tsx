import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { SiteFooter } from '../../../shared/components/SiteFooter/SiteFooter';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { Hero } from './Hero';
import { Gallery } from './Gallery';
import { Manifesto } from './Manifesto';
import { FeaturedBooks } from './FeaturedBooks';
import { CollectionTeaser } from './CollectionTeaser';
import { About } from './About';
import { Newsletter } from './Newsletter';
import styles from './HomePage.module.css';

/** `/` — the editorial home page (architecture.md §1.3). */
export function HomePage() {
  useDocumentTitle('Nuestra Medicina Personal');

  return (
    <div className={styles.page}>
      <GradientTopBar />
      <SiteHeader />

      <Hero />
      <Gallery />
      <Manifesto />
      <FeaturedBooks />

      <section id="meditaciones" className={styles.meditacionesSection}>
        <CollectionTeaser
          eyebrowColor="var(--color-sky)"
          underlineEndColor="var(--color-sky)"
          title="Meditaciones"
          description="Prácticas breves para volver a habitar el cuerpo y la respiración."
          ctaLabel="Explorar meditaciones"
          ctaTo="/meditaciones"
          imageAccent="var(--color-sky-pale)"
          imageCaption="Colección — Meditaciones"
        />
      </section>

      <section id="herramientas" className={styles.herramientasSection}>
        <div className={styles.herramientasInner}>
          <CollectionTeaser
            reverse
            eyebrowColor="var(--color-accent-gold)"
            underlineEndColor="var(--color-accent-amber)"
            title="Caja de herramientas personales"
            description="Recursos simples para sostener la escritura y la reflexión en el día a día."
            ctaLabel="Explorar herramientas"
            ctaTo="/herramientas"
            imageAccent="color-mix(in oklch, var(--color-accent-gold) 45%, transparent)"
            imageCaption="Colección — Caja de herramientas personales"
          />
        </div>
      </section>

      <About />
      <Newsletter />
      <SiteFooter />
    </div>
  );
}
