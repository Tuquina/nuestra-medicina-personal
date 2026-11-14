import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { CmsEditorActions, CmsEditorLoadState } from '../../components/CmsEditorTools/CmsEditorTools';
import { FormField } from '../../../shared/components/FormField/FormField';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useEditablePage } from '../../../shared/cms/useEditablePage';
import type { PageContent } from '../../../shared/cms/types';
import {
  buildMeditationSeedContent,
  parseYouTubeId,
  readMeditationProps,
  withMeditationProps,
  youTubeEmbedUrl,
  youTubeWatchUrl,
  type MeditationProps,
} from '../../../shared/cms/meditationContent';
import { MediaImageField } from './MediaImageField';
import f from '../../../shared/components/FormField/FormField.module.css';
import editor from '../../components/EditorForm/EditorForm.module.css';
import styles from './MeditacionesAdmin.module.css';

/** `/admin/meditaciones/:slug` — edits one meditation page (draft → publish, versions, preview). */
export function MeditacionEditorPage() {
  const { slug = '' } = useParams();
  const seed = useCallback(() => buildMeditationSeedContent('Nueva meditación'), []);
  const page = useEditablePage({ type: 'MEDITACION', slug, title: 'Nueva meditación', seed });
  const meditation = readMeditationProps(page.content);
  const heading = meditation?.title || 'Meditación';
  useDocumentTitle(`${heading} · Meditaciones · Admin · Nuestra Medicina Personal`);

  if (page.loadStatus !== 'ready' || !meditation) {
    return (
      <AdminLayout title="Meditación">
        <CmsEditorLoadState editor={page} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={heading}>
      <CmsEditorActions editor={page} content={page.content} publicPath={`/meditaciones/${slug}?preview=1`} />
      <MeditationForm
        key={page.record?.id}
        meditation={meditation}
        onChange={(props) => page.setContent(withMeditationProps(page.content, props) as PageContent)}
      />
    </AdminLayout>
  );
}

function MeditationForm({ meditation, onChange }: { meditation: MeditationProps; onChange: (props: MeditationProps) => void }) {
  const [videoInput, setVideoInput] = useState(meditation.video ? youTubeWatchUrl(meditation.video.videoId) : '');
  const update = (patch: Partial<MeditationProps>) => onChange({ ...meditation, ...patch });

  const videoId = parseYouTubeId(videoInput);
  const videoInvalid = videoInput.trim() !== '' && !videoId;

  const changeVideo = (value: string) => {
    setVideoInput(value);
    const parsed = parseYouTubeId(value);
    if (value.trim() === '') update({ video: null });
    else if (parsed) update({ video: { provider: 'youtube', videoId: parsed } });
    // An unrecognised link keeps the last valid video until it's fixed.
  };

  return (
    <>
      <div className={editor.section}>
        <h2 className={editor.sectionTitle}>Tarjeta y presentación</h2>
        <p className={editor.sectionHint}>
          El título, la descripción y la imagen se muestran en la tarjeta de /meditaciones y al comienzo de la página.
        </p>

        <FormField label="Título" htmlFor="meditationTitle">
          <input
            id="meditationTitle"
            type="text"
            className={f.control}
            value={meditation.title}
            maxLength={200}
            onChange={(event) => update({ title: event.target.value })}
          />
        </FormField>

        <FormField label="Descripción" htmlFor="meditationDescription">
          <textarea
            id="meditationDescription"
            rows={3}
            className={f.control}
            value={meditation.description}
            maxLength={600}
            onChange={(event) => update({ description: event.target.value })}
          />
        </FormField>

        <div className={f.field} role="group" aria-labelledby="meditationImageLabel">
          <span id="meditationImageLabel" className={f.label}>
            Imagen
          </span>
          <MediaImageField
            imageId={meditation.imageId}
            alt={meditation.imageAlt}
            onChange={(imageId) => update({ imageId })}
          />
        </div>

        <FormField label="Descripción de la imagen (para lectores de pantalla)" htmlFor="meditationImageAlt">
          <input
            id="meditationImageAlt"
            type="text"
            className={f.control}
            value={meditation.imageAlt}
            maxLength={300}
            placeholder="Por ejemplo: amanecer sobre el mar en calma"
            onChange={(event) => update({ imageAlt: event.target.value })}
          />
        </FormField>

        <FormField label="Duración aproximada (minutos, opcional)" htmlFor="meditationDuration">
          <input
            id="meditationDuration"
            type="number"
            min={1}
            max={180}
            className={f.control}
            value={meditation.durationMinutes ?? ''}
            onChange={(event) => {
              const minutes = Number.parseInt(event.target.value, 10);
              update({ durationMinutes: Number.isFinite(minutes) && minutes >= 1 ? Math.min(minutes, 180) : null });
            }}
          />
        </FormField>
      </div>

      <div className={editor.section}>
        <h2 className={editor.sectionTitle}>Video</h2>
        <p className={editor.sectionHint}>
          Pegá el link de YouTube (por ejemplo https://www.youtube.com/watch?v=…). Se muestra con el reproductor de
          privacidad mejorada de YouTube.
        </p>
        <FormField label="Link de YouTube" htmlFor="meditationVideo">
          <input
            id="meditationVideo"
            type="url"
            className={f.control}
            value={videoInput}
            placeholder="https://www.youtube.com/watch?v=…"
            onChange={(event) => changeVideo(event.target.value)}
          />
        </FormField>
        {videoInvalid && (
          <p className={styles.fieldError} role="alert">
            No reconocemos ese link de YouTube. Se mantiene el video anterior hasta que lo corrijas.
          </p>
        )}
        {videoId && (
          <div className={styles.videoPreview}>
            <div className={styles.videoFrame}>
              <iframe src={youTubeEmbedUrl(videoId)} title="Vista previa del video" loading="lazy" allowFullScreen />
            </div>
          </div>
        )}
      </div>

      <div className={editor.section}>
        <h2 className={editor.sectionTitle}>Guía de la práctica</h2>
        <p className={editor.sectionHint}>
          Texto que acompaña al video (opcional). Dejá una línea en blanco entre párrafos.
        </p>
        <FormField label="Guía" htmlFor="meditationGuidance">
          <textarea
            id="meditationGuidance"
            rows={8}
            className={f.control}
            value={meditation.guidance}
            maxLength={6000}
            onChange={(event) => update({ guidance: event.target.value })}
          />
        </FormField>
      </div>
    </>
  );
}
