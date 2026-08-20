import { useSearchParams } from 'react-router-dom';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { SiteFooter } from '../../../shared/components/SiteFooter/SiteFooter';
import { CollectionHero } from '../../../shared/components/CollectionHero/CollectionHero';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { usePublishedContent } from '../../../shared/cms/usePublishedContent';
import { CONTACTO_SLUG, readContactoProps } from '../../../shared/cms/helpContent';
import { CmsPageState } from '../../../shared/cms/CmsPageState';
import styles from './ContactoPage.module.css';

/** `/contacto` — content comes from the admin's "Ayuda" editor via shared/cms. */
export function ContactoPage() {
  useDocumentTitle('Contacto · Nuestra Medicina Personal');
  const [searchParams] = useSearchParams();
  const preview = searchParams.get('preview') === '1';
  const page = usePublishedContent('CONTACTO', CONTACTO_SLUG, preview);
  if (page.status !== 'ready') return <CmsPageState state={page} />;
  const { title, intro, methods } = readContactoProps(page.content);

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
        eyebrowColor="var(--color-deep-blue)"
        glowColor="var(--color-sky)"
        title={title}
        description={intro}
      />

      <div className={styles.section}>
        <div className={styles.methods}>
          {methods.map((method) => (
            <div key={method.id} className={styles.method}>
              <span className={styles.methodLabel}>{method.label}</span>
              <a className={styles.methodValue} href={method.href}>
                {method.value}
              </a>
            </div>
          ))}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
