import type { ReactNode } from 'react';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { MinimalFooter } from '../../../shared/components/MinimalFooter/MinimalFooter';
import { CollectionHero } from '../../../shared/components/CollectionHero/CollectionHero';
import { ComingSoonCard } from '../../../shared/components/ComingSoonCard/ComingSoonCard';
import { NewsletterSignup } from '../../../shared/components/NewsletterSignup/NewsletterSignup';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import type { ToolSlug } from '../../../shared/cms/collectionContent';
import { ToolCard } from '../ToolCard/ToolCard';
import styles from './ComingSoonCollectionPage.module.css';

interface CollectionCardData {
  title: string;
  description: string;
  imageAccent: string;
  imageBase?: string;
  imageCaption: string;
  /** When set, the card opens that interactive tool instead of showing "Próximamente". */
  tool?: ToolSlug;
}

interface NewsletterCopy {
  title: string;
  buttonLabel: string;
  confirmationText: string;
}

interface ComingSoonCollectionPageProps {
  title: string;
  description: string;
  eyebrowColor: string;
  glowColor: string;
  cards: CollectionCardData[];
  /** Real items shown before the CMS cards (e.g. published meditations). */
  leadingCards?: ReactNode;
  /** Overrides the default "te avisamos cuando estén disponibles" signup copy. */
  newsletter?: NewsletterCopy;
  /** True when rendering an admin's "Vista previa" of unpublished changes. */
  preview?: boolean;
}

const COMING_SOON_NEWSLETTER: NewsletterCopy = {
  title: 'Te avisamos cuando estén disponibles',
  buttonLabel: 'Avisarme',
  confirmationText: 'Gracias — te vamos a avisar por correo.',
};

/**
 * The shared template behind `/meditaciones` and `/herramientas`: both
 * mockups are pixel-identical in structure (hero, card grid, signup,
 * minimal footer) and differ only in copy and color, per the taxonomy in
 * architecture.md §1.1. Cards are "coming soon" placeholders unless they
 * link to an interactive tool (today only Herramientas has those).
 */
export function ComingSoonCollectionPage({
  title,
  description,
  eyebrowColor,
  glowColor,
  cards,
  leadingCards,
  newsletter = COMING_SOON_NEWSLETTER,
  preview = false,
}: ComingSoonCollectionPageProps) {
  useDocumentTitle(`${title} · Nuestra Medicina Personal`);

  return (
    <div className={styles.page}>
      {preview && (
        <div className={styles.previewBanner} role="status">
          Vista previa — estás viendo cambios sin publicar.
        </div>
      )}
      <GradientTopBar />
      <SiteHeader />

      <CollectionHero
        eyebrow="Colección"
        eyebrowColor={eyebrowColor}
        glowColor={glowColor}
        title={title}
        description={description}
      />

      <section className={styles.gridSection}>
        <div className={styles.grid}>
          {leadingCards}
          {cards.map(({ tool, ...card }) =>
            tool ? (
              <ToolCard key={card.title} title={card.title} description={card.description} tool={tool} />
            ) : (
              <ComingSoonCard key={card.title} {...card} />
            ),
          )}
        </div>
      </section>

      <NewsletterSignup {...newsletter} />

      <MinimalFooter />
    </div>
  );
}
