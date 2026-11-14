import { useSearchParams } from 'react-router-dom';
import { ComingSoonCollectionPage } from '../../components/ComingSoonCollectionPage/ComingSoonCollectionPage';
import { MeditationCard } from '../../components/MeditationCard/MeditationCard';
import { useMeditations } from '../../hooks/useMeditations';
import { usePublishedContent } from '../../../shared/cms/usePublishedContent';
import { MEDITACIONES_SLUG, readCollectionProps } from '../../../shared/cms/collectionContent';
import { CmsPageState } from '../../../shared/cms/CmsPageState';

/** Decorative accents rotate by card index — editable content is just
 * title/description/caption, colors stay a design decision (same
 * approach as HomePage's Gallery). */
const CARD_ACCENTS = [
  { imageAccent: 'var(--color-sky-pale)' },
  { imageAccent: 'var(--color-accent-amber-soft)' },
  { imageAccent: 'oklch(32% 0.06 254)', imageBase: 'oklch(45% 0.05 254)' },
];

/** `/meditaciones` — built from Meditaciones.dc.html. The hero and the
 * "Próximamente" cards come from the admin's "Meditaciones" editor; the
 * published meditation pages (`/meditaciones/:slug`) are listed first. */
export function MeditacionesPage() {
  const [searchParams] = useSearchParams();
  const preview = searchParams.get('preview') === '1';
  const page = usePublishedContent('MEDITACIONES', MEDITACIONES_SLUG, preview);
  const meditations = useMeditations();
  if (page.status !== 'ready') return <CmsPageState state={page} />;
  const { title, description, cards } = readCollectionProps(page.content);
  const published = meditations.items;

  return (
    <ComingSoonCollectionPage
      title={title}
      description={description}
      eyebrowColor="var(--color-sky)"
      glowColor="var(--color-sky)"
      leadingCards={published.map((meditation, i) => (
        <MeditationCard
          key={meditation.slug}
          meditation={meditation}
          accent={CARD_ACCENTS[i % CARD_ACCENTS.length].imageAccent}
        />
      ))}
      cards={cards.map((card, i) => ({ ...card, ...CARD_ACCENTS[(i + published.length) % CARD_ACCENTS.length] }))}
      preview={preview}
    />
  );
}
