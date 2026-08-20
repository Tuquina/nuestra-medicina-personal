import { mediaUrl } from '../../config/api';
import { ImagePlaceholder } from '../ImagePlaceholder/ImagePlaceholder';
import styles from './BookCover.module.css';

interface BookCoverProps {
  mediaId: string | null;
  title: string;
  accent: string;
  caption?: string;
  borderRadius?: string;
  className?: string;
}

/** Renders an uploaded cover when present and preserves the designed placeholder otherwise. */
export function BookCover({
  mediaId,
  title,
  accent,
  caption,
  borderRadius = '4px',
  className,
}: BookCoverProps) {
  if (!mediaId) {
    return (
      <ImagePlaceholder
        className={className}
        accent={accent}
        caption={caption}
        alt={`Portada — ${title}`}
        aspectRatio="2 / 3"
        borderRadius={borderRadius}
      />
    );
  }

  return (
    <img
      className={[styles.image, className].filter(Boolean).join(' ')}
      src={mediaUrl(mediaId)}
      alt={`Portada — ${title}`}
      loading="lazy"
    />
  );
}
