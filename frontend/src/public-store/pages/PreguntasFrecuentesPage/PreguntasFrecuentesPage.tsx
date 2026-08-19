import { useSearchParams } from 'react-router-dom';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { SiteFooter } from '../../../shared/components/SiteFooter/SiteFooter';
import { CollectionHero } from '../../../shared/components/CollectionHero/CollectionHero';
import { FaqAccordion } from '../../../shared/components/FaqAccordion/FaqAccordion';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { usePublishedContent } from '../../../shared/cms/usePublishedContent';
import { buildFaqSeedContent, FAQ_SLUG, readFaqProps } from '../../../shared/cms/helpContent';
import styles from './PreguntasFrecuentesPage.module.css';

/** `/preguntas-frecuentes` — content comes from the admin's "Ayuda" editor via shared/cms. */
export function PreguntasFrecuentesPage() {
  useDocumentTitle('Preguntas frecuentes · Nuestra Medicina Personal');
  const [searchParams] = useSearchParams();
  const preview = searchParams.get('preview') === '1';
  const content = usePublishedContent('FAQ', FAQ_SLUG, buildFaqSeedContent, preview);
  const { title, intro, faqs } = readFaqProps(content);

  return (
    <div>
      {preview && (
        <div className={styles.previewBanner} role="status">
          Vista previa — estás viendo cambios sin publicar.
        </div>
      )}
      <GradientTopBar />
      <SiteHeader />

      <CollectionHero
        eyebrow="Ayuda"
        eyebrowColor="var(--color-sky)"
        glowColor="var(--color-sky)"
        title={title}
        description={intro}
      />

      <FaqAccordion faqs={faqs} heading="" />

      <SiteFooter />
    </div>
  );
}
