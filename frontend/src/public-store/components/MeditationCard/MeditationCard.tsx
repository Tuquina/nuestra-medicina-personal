import { Link } from 'react-router-dom';
import { ImagePlaceholder } from '../../../shared/components/ImagePlaceholder/ImagePlaceholder';
import { mediaUrl } from '../../../shared/config/api';
import { durationLabel, type MeditationSummary } from '../../../shared/cms/meditationContent';
import styles from './MeditationCard.module.css';

interface MeditationCardProps {
  meditation: MeditationSummary;
  /** Placeholder stripe color when the meditation has no image yet. */
  accent: string;
}

/** A published meditation in the `/meditaciones` grid; opens its page. */
export function MeditationCard({ meditation, accent }: MeditationCardProps) {
  const duration = durationLabel(meditation.durationMinutes);
  return (
    <Link to={`/meditaciones/${meditation.slug}`} className={styles.card}>
      <div className={styles.cover}>
        {meditation.imageId ? (
          <img
            className={styles.image}
            src={mediaUrl(meditation.imageId)}
            alt={meditation.imageAlt}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <ImagePlaceholder accent={accent} alt={meditation.imageAlt || meditation.title} aspectRatio="4 / 3" />
        )}
        {meditation.hasVideo && (
          <span className={styles.play} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
        )}
      </div>
      <h3 className={styles.title}>{meditation.title}</h3>
      <p className={styles.description}>{meditation.description}</p>
      <span className={styles.meta}>
        {[duration, meditation.hasVideo ? 'Video guiado' : null].filter(Boolean).join(' · ')}
      </span>
      <span className={styles.cta}>
        Ver meditación <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
