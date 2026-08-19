import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { MinimalFooter } from '../../../shared/components/MinimalFooter/MinimalFooter';
import { CollectionHero } from '../../../shared/components/CollectionHero/CollectionHero';
import { ComingSoonCard } from '../../../shared/components/ComingSoonCard/ComingSoonCard';
import { NewsletterSignup } from '../../../shared/components/NewsletterSignup/NewsletterSignup';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import styles from './ComingSoonCollectionPage.module.css';

interface ComingSoonCardData {
  title: string;
  description: string;
  imageAccent: string;
  imageBase?: string;
  imageCaption: string;
}

interface ComingSoonCollectionPageProps {
  title: string;
  description: string;
  eyebrowColor: string;
  glowColor: string;
  cards: ComingSoonCardData[];
}

/**
 * The shared template behind `/meditaciones` and `/herramientas`: both
 * mockups are pixel-identical in structure (hero, 3-card "coming soon"
 * grid, notify-me signup, minimal footer) and differ only in copy and
 * color, per the taxonomy in architecture.md §1.1 — those collections
 * don't have real content yet, only Book does.
 */
export function ComingSoonCollectionPage({
  title,
  description,
  eyebrowColor,
  glowColor,
  cards,
}: ComingSoonCollectionPageProps) {
  useDocumentTitle(`${title} · Nuestra Medicina Personal`);

  return (
    <div className={styles.page}>
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
          {cards.map((card) => (
            <ComingSoonCard key={card.title} {...card} />
          ))}
        </div>
      </section>

      <NewsletterSignup
        title="Te avisamos cuando estén disponibles"
        buttonLabel="Avisarme"
        confirmationText="Gracias — te vamos a avisar por correo."
      />

      <MinimalFooter />
    </div>
  );
}
