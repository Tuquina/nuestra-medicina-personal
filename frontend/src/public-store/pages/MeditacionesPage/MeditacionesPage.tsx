import { useSearchParams } from 'react-router-dom';
import { ComingSoonCollectionPage } from '../../components/ComingSoonCollectionPage/ComingSoonCollectionPage';
import { usePublishedContent } from '../../../shared/cms/usePublishedContent';
import { buildMeditacionesSeedContent, MEDITACIONES_SLUG, readCollectionProps } from '../../../shared/cms/collectionContent';

/** Decorative accents rotate by card index — editable content is just
 * title/description/caption, colors stay a design decision (same
 * approach as HomePage's Gallery). */
const CARD_ACCENTS = [
  { imageAccent: 'var(--color-sky-pale)' },
  { imageAccent: 'var(--color-accent-amber-soft)' },
  { imageAccent: 'oklch(32% 0.06 254)', imageBase: 'oklch(45% 0.05 254)' },
];

/** `/meditaciones` — built from Meditaciones.dc.html. Content comes from
 * the admin's "Meditaciones" editor via shared/cms. */
export function MeditacionesPage() {
  const [searchParams] = useSearchParams();
  const preview = searchParams.get('preview') === '1';
  const content = usePublishedContent('MEDITACIONES', MEDITACIONES_SLUG, buildMeditacionesSeedContent, preview);
  const { title, description, cards } = readCollectionProps(content);

  return (
    <ComingSoonCollectionPage
      title={title}
      description={description}
      eyebrowColor="var(--color-sky)"
      glowColor="var(--color-sky)"
      cards={cards.map((card, i) => ({ ...card, ...CARD_ACCENTS[i % CARD_ACCENTS.length] }))}
      preview={preview}
    />
  );
}
