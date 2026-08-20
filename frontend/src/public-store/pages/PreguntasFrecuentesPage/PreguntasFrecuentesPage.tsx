import { useSearchParams } from 'react-router-dom';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { SiteFooter } from '../../../shared/components/SiteFooter/SiteFooter';
import { CollectionHero } from '../../../shared/components/CollectionHero/CollectionHero';
import { FaqAccordion } from '../../../shared/components/FaqAccordion/FaqAccordion';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { usePublishedContent } from '../../../shared/cms/usePublishedContent';
import { FAQ_SLUG, readFaqProps } from '../../../shared/cms/helpContent';
import { CmsPageState } from '../../../shared/cms/CmsPageState';
import styles from './PreguntasFrecuentesPage.module.css';

/** `/preguntas-frecuentes` — content comes from the admin's "Ayuda" editor via shared/cms. */
export function PreguntasFrecuentesPage() {
  useDocumentTitle('Preguntas frecuentes · Nuestra Medicina Personal');
  const [searchParams] = useSearchParams();
  const preview = searchParams.get('preview') === '1';
  const page = usePublishedContent('FAQ', FAQ_SLUG, preview);
  if (page.status !== 'ready') return <CmsPageState state={page} />;
  const { title, intro, faqs } = readFaqProps(page.content);

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
