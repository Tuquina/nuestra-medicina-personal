import type { Section } from '../../../shared/cms/types';
import type {
  AboutProps,
  CollectionTeaserProps,
  DividerBlockProps,
  FeaturedBooksProps,
  GalleryProps,
  HeroProps,
  ImageBlockProps,
  ManifestoProps,
  NewsletterProps,
  QuoteBlockProps,
  SpacerBlockProps,
  TextBlockProps,
  TitleBlockProps,
} from '../../../shared/cms/homeContent';
import { Hero } from './Hero';
import { Gallery } from './Gallery';
import { Manifesto } from './Manifesto';
import { FeaturedBooks } from './FeaturedBooks';
import { CollectionTeaser } from './CollectionTeaser';
import { About } from './About';
import { Newsletter } from './Newsletter';
import { TitleBlock, TextBlock, ImageBlock, QuoteBlock, DividerBlock, SpacerBlock } from './GenericBlocks';
import styles from './HomePage.module.css';

/** Each section's `props` is stored as a loosely-typed bag (see
 * shared/cms/types.ts); this just casts it to the shape the matching `type`
 * is known to carry. */
function asProps<T>(props: Record<string, unknown>): T {
  return props as unknown as T;
}

/**
 * Renders one Home page section's content by `type`, reading `props` from
 * the content store (see shared/cms/homeContent.ts). Unknown types are
 * skipped rather than crashing the page — keeps the public site resilient
 * to a stray/future block type. Ignores `hidden` — callers decide what to
 * do with a hidden section (the public page skips it via `HomeSection`
 * below; the admin Page Builder's canvas still renders it, faded, so it
 * can be selected and re-shown).
 */
export function HomeSectionContent({ section }: { section: Section }) {
  switch (section.type) {
    case 'hero':
      return <Hero {...asProps<HeroProps>(section.props)} />;
    case 'gallery':
      return <Gallery {...asProps<GalleryProps>(section.props)} />;
    case 'manifesto':
      return <Manifesto {...asProps<ManifestoProps>(section.props)} />;
    case 'featured-books':
      return <FeaturedBooks {...asProps<FeaturedBooksProps>(section.props)} />;
    case 'collection-teaser': {
      const props = asProps<CollectionTeaserProps>(section.props);
      const isHerramientas = section.id === 'herramientas';
      const body = <CollectionTeaser {...props} />;
      return (
        <section id={section.id} className={isHerramientas ? styles.herramientasSection : styles.meditacionesSection}>
          {isHerramientas ? <div className={styles.herramientasInner}>{body}</div> : body}
        </section>
      );
    }
    case 'about':
      return <About {...asProps<AboutProps>(section.props)} />;
    case 'newsletter':
      return <Newsletter {...asProps<NewsletterProps>(section.props)} />;
    case 'title':
      return <TitleBlock {...asProps<TitleBlockProps>(section.props)} />;
    case 'text':
      return <TextBlock {...asProps<TextBlockProps>(section.props)} />;
    case 'image':
      return <ImageBlock {...asProps<ImageBlockProps>(section.props)} />;
    case 'quote':
      return <QuoteBlock {...asProps<QuoteBlockProps>(section.props)} />;
    case 'divider':
      return <DividerBlock {...asProps<DividerBlockProps>(section.props)} />;
    case 'spacer':
      return <SpacerBlock {...asProps<SpacerBlockProps>(section.props)} />;
    default:
      return null;
  }
}

/** Public-facing wrapper: skips rendering entirely when hidden. */
export function HomeSection({ section }: { section: Section }) {
  if (section.hidden) return null;
  return <HomeSectionContent section={section} />;
}
