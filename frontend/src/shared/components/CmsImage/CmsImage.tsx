import { useState, type ComponentProps } from 'react';
import { ImagePlaceholder } from '../ImagePlaceholder/ImagePlaceholder';
import { mediaUrl } from '../../config/api';
import styles from './CmsImage.module.css';

type CmsImageProps = ComponentProps<typeof ImagePlaceholder> & {
  imageId?: string;
  priority?: boolean;
};

/** Existing drafts keep their placeholder until an image is selected. */
export function CmsImage({ imageId, priority = false, ...placeholder }: CmsImageProps) {
  const [failedId, setFailedId] = useState<string>();
  if (!imageId || failedId === imageId) return <ImagePlaceholder {...placeholder} />;
  return (
    <div
      className={[styles.frame, placeholder.className].filter(Boolean).join(' ')}
      style={{ aspectRatio: placeholder.aspectRatio, borderRadius: placeholder.borderRadius }}
    >
      <img
        src={mediaUrl(imageId)}
        alt={placeholder.alt ?? placeholder.caption ?? ''}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onError={() => setFailedId(imageId)}
      />
    </div>
  );
}
