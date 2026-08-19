import { useSearchParams } from 'react-router-dom';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { SiteFooter } from '../../../shared/components/SiteFooter/SiteFooter';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { usePublishedContent } from '../../../shared/cms/usePublishedContent';
import { buildHomeSeedContent } from '../../../shared/cms/homeContent';
import { HOME_SLUG } from '../../../shared/cms/types';
import { HomeSection } from './HomeSections';
import styles from './HomePage.module.css';

/** `/` — the editorial home page (architecture.md §1.3). Section content,
 * order and visibility come from the admin's Page Builder (see
 * shared/cms) — this component just renders whatever's published. */
export function HomePage() {
  useDocumentTitle('Nuestra Medicina Personal');
  const [searchParams] = useSearchParams();
  const preview = searchParams.get('preview') === '1';
  const content = usePublishedContent('HOME', HOME_SLUG, buildHomeSeedContent, preview);

  return (
    <div className={styles.page}>
      {preview && (
        <div className={styles.previewBanner} role="status">
          Vista previa — estás viendo cambios sin publicar.
        </div>
      )}
      <GradientTopBar />
      <SiteHeader />

      {content.sections.map((section) => (
        <HomeSection key={section.id} section={section} />
      ))}

      <SiteFooter />
    </div>
  );
}
