import { useSearchParams } from 'react-router-dom';
import { ComingSoonCollectionPage } from '../../components/ComingSoonCollectionPage/ComingSoonCollectionPage';
import { usePublishedContent } from '../../../shared/cms/usePublishedContent';
import { buildHerramientasSeedContent, HERRAMIENTAS_SLUG, readCollectionProps } from '../../../shared/cms/collectionContent';

/** Decorative accents rotate by card index — editable content is just
 * title/description/caption, colors stay a design decision (same
 * approach as HomePage's Gallery). */
const CARD_ACCENTS = [
  { imageAccent: 'color-mix(in oklch, var(--color-accent-gold) 45%, transparent)' },
  { imageAccent: 'color-mix(in oklch, var(--color-sky) 60%, transparent)' },
  { imageAccent: 'var(--color-accent-amber-soft)' },
];

/** `/herramientas` — built from Herramientas.dc.html. Content comes from
 * the admin's "Herramientas" editor via shared/cms. */
export function HerramientasPage() {
  const [searchParams] = useSearchParams();
  const preview = searchParams.get('preview') === '1';
  const content = usePublishedContent('HERRAMIENTAS', HERRAMIENTAS_SLUG, buildHerramientasSeedContent, preview);
  const { title, description, cards } = readCollectionProps(content);

  return (
    <ComingSoonCollectionPage
      title={title}
      description={description}
      eyebrowColor="var(--color-accent-gold)"
      glowColor="var(--color-accent-amber-soft)"
      cards={cards.map((card, i) => ({ ...card, ...CARD_ACCENTS[i % CARD_ACCENTS.length] }))}
      preview={preview}
    />
  );
}
