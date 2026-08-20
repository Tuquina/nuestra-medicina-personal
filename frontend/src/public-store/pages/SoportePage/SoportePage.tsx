import { Link, useSearchParams } from 'react-router-dom';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { SiteFooter } from '../../../shared/components/SiteFooter/SiteFooter';
import { CollectionHero } from '../../../shared/components/CollectionHero/CollectionHero';
import { FeatureGrid } from '../../../shared/components/FeatureGrid/FeatureGrid';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { usePublishedContent } from '../../../shared/cms/usePublishedContent';
import { readSoporteProps, SOPORTE_SLUG } from '../../../shared/cms/helpContent';
import { CmsPageState } from '../../../shared/cms/CmsPageState';
import styles from './SoportePage.module.css';

/** `/soporte` — content comes from the admin's "Ayuda" editor via shared/cms. */
export function SoportePage() {
  useDocumentTitle('Soporte · Nuestra Medicina Personal');
  const [searchParams] = useSearchParams();
  const preview = searchParams.get('preview') === '1';
  const page = usePublishedContent('SOPORTE', SOPORTE_SLUG, preview);
  if (page.status !== 'ready') return <CmsPageState state={page} />;
  const { title, intro, topics } = readSoporteProps(page.content);

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
        eyebrowColor="var(--color-accent-gold)"
        glowColor="var(--color-accent-amber-soft)"
        title={title}
        description={intro}
      />

      <FeatureGrid items={topics.map((topic) => ({ title: topic.title, description: topic.description }))} />

      <p className={styles.contactHint}>
        ¿No encontraste lo que buscabas? <Link to="/contacto">Escribinos</Link>.
      </p>

      <SiteFooter />
    </div>
  );
}
