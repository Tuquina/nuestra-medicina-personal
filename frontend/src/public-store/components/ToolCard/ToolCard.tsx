import { CmsImage } from '../../../shared/components/CmsImage/CmsImage';
import { Link } from 'react-router-dom';
import { toolPath, type ToolSlug } from '../../../shared/cms/collectionContent';
import { ToolIllustration } from '../ToolIllustration/ToolIllustration';
import styles from './ToolCard.module.css';

interface ToolCardProps {
  title: string;
  description: string;
  tool: ToolSlug;
  imageId?: string;
  imageCaption?: string;
}

/** A Herramientas card that opens one of the interactive tools. */
export function ToolCard({ title, description, tool, imageId, imageCaption }: ToolCardProps) {
  return (
    <Link to={toolPath(tool)} className={styles.card}>
      <div className={styles.cover}>
        {imageId ? <CmsImage imageId={imageId} caption={imageCaption ?? title} accent="var(--color-sky-pale)" aspectRatio="4 / 3" /> : <ToolIllustration tool={tool} className={styles.illustration} />}
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      <span className={styles.cta}>
        Abrir herramienta <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
