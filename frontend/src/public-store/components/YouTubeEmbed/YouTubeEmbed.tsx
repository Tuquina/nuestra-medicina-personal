import { youTubeEmbedUrl, youTubeWatchUrl } from '../../../shared/cms/meditationContent';
import styles from './YouTubeEmbed.module.css';

interface YouTubeEmbedProps {
  videoId: string;
  /** Accessible name of the player, e.g. the meditation's title. */
  title: string;
}

/**
 * A responsive 16:9 YouTube player using the privacy-enhanced
 * youtube-nocookie domain. The URL is always built from a validated bare
 * video id (see parseYouTubeId), never from free-form editor input.
 */
export function YouTubeEmbed({ videoId, title }: YouTubeEmbedProps) {
  return (
    <figure className={styles.figure}>
      <div className={styles.frame}>
        <iframe
          className={styles.iframe}
          src={youTubeEmbedUrl(videoId)}
          title={title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
      <figcaption className={styles.caption}>
        ¿No se ve el video?{' '}
        <a href={youTubeWatchUrl(videoId)} target="_blank" rel="noopener noreferrer">
          Abrilo en YouTube
        </a>
        .
      </figcaption>
    </figure>
  );
}
