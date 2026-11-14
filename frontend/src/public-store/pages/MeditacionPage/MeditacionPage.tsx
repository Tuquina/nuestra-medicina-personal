import { useParams, useSearchParams } from 'react-router-dom';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { MinimalFooter } from '../../../shared/components/MinimalFooter/MinimalFooter';
import { BackLink } from '../../../shared/components/BackLink/BackLink';
import { Eyebrow } from '../../../shared/components/Eyebrow/Eyebrow';
import { ImagePlaceholder } from '../../../shared/components/ImagePlaceholder/ImagePlaceholder';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { mediaUrl } from '../../../shared/config/api';
import { usePublishedContent } from '../../../shared/cms/usePublishedContent';
import { CmsPageState } from '../../../shared/cms/CmsPageState';
import {
  durationLabel,
  guidanceParagraphs,
  readMeditationProps,
  type MeditationProps,
} from '../../../shared/cms/meditationContent';
import { MeditationCard } from '../../components/MeditationCard/MeditationCard';
import { YouTubeEmbed } from '../../components/YouTubeEmbed/YouTubeEmbed';
import { useMeditations } from '../../hooks/useMeditations';
import styles from './MeditacionPage.module.css';

/** `/meditaciones/:slug` — one guided meditation (page type MEDITACION). */
export function MeditacionPage() {
  const { slug = '' } = useParams();
  const [searchParams] = useSearchParams();
  const preview = searchParams.get('preview') === '1';
  const page = usePublishedContent('MEDITACION', slug, preview);
  if (page.status !== 'ready') return <CmsPageState state={page} />;
  const meditation = readMeditationProps(page.content);
  if (!meditation) {
    return <CmsPageState state={{ status: 'not-found', content: null, retry: page.retry }} />;
  }
  return <Meditation slug={slug} meditation={meditation} preview={preview} />;
}

function Meditation({ slug, meditation, preview }: { slug: string; meditation: MeditationProps; preview: boolean }) {
  useDocumentTitle(`${meditation.title} · Meditaciones · Nuestra Medicina Personal`);
  const others = useMeditations().items.filter((item) => item.slug !== slug).slice(0, 3);
  const duration = durationLabel(meditation.durationMinutes);
  const paragraphs = guidanceParagraphs(meditation.guidance);

  return (
    <div className={styles.page}>
      {preview && (
        <div className={styles.previewBanner} role="status">
          Vista previa — estás viendo cambios sin publicar.
        </div>
      )}
      <GradientTopBar />
      <SiteHeader />
      <BackLink to="/meditaciones">Volver a Meditaciones</BackLink>

      <main className={styles.main}>
        <header className={styles.header}>
          <Eyebrow color="var(--color-sky)">Meditación</Eyebrow>
          <h1 className={`${styles.title} gradient-text`}>{meditation.title}</h1>
          <p className={styles.description}>{meditation.description}</p>
          {duration && <p className={styles.meta}>Duración aproximada: {duration}</p>}
        </header>

        <section className={styles.media} aria-label="Práctica guiada">
          {meditation.video ? (
            <YouTubeEmbed videoId={meditation.video.videoId} title={`Meditación guiada: ${meditation.title}`} />
          ) : meditation.imageId ? (
            <img
              className={styles.image}
              src={mediaUrl(meditation.imageId)}
              alt={meditation.imageAlt}
              decoding="async"
            />
          ) : (
            <ImagePlaceholder accent="var(--color-sky-pale)" alt={meditation.imageAlt || meditation.title} aspectRatio="16 / 9" />
          )}
        </section>

        {paragraphs.length > 0 && (
          <section className={styles.guidance} aria-labelledby="guidance-title">
            <h2 id="guidance-title" className={styles.sectionTitle}>
              Antes de empezar
            </h2>
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </section>
        )}

        <aside className={styles.care} aria-label="Una nota de cuidado">
          <p>
            Practicá a tu ritmo y sin exigirte. Si algo te incomoda, podés abrir los ojos, moverte o detenerte cuando
            quieras. Estas prácticas acompañan, pero no reemplazan un espacio terapéutico.
          </p>
        </aside>

        {others.length > 0 && (
          <section className={styles.others} aria-labelledby="others-title">
            <h2 id="others-title" className={styles.sectionTitle}>
              Otras meditaciones
            </h2>
            <div className={styles.othersGrid}>
              {others.map((item) => (
                <MeditationCard key={item.slug} meditation={item} accent="var(--color-sky-pale)" />
              ))}
            </div>
          </section>
        )}
      </main>

      <MinimalFooter />
    </div>
  );
}
