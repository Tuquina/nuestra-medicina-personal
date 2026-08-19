import { useParams } from 'react-router-dom';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { SiteFooter } from '../../../shared/components/SiteFooter/SiteFooter';
import { BackLink } from '../../../shared/components/BackLink/BackLink';
import { BookHero } from '../../../shared/components/BookHero/BookHero';
import { Synopsis } from '../../../shared/components/Synopsis/Synopsis';
import { ImageTextSection } from '../../../shared/components/ImageTextSection/ImageTextSection';
import { FeatureGrid } from '../../../shared/components/FeatureGrid/FeatureGrid';
import { QuoteBanner } from '../../../shared/components/QuoteBanner/QuoteBanner';
import { BookDetailsGrid } from '../../../shared/components/BookDetailsGrid/BookDetailsGrid';
import { FaqAccordion } from '../../../shared/components/FaqAccordion/FaqAccordion';
import { RelatedBooks } from '../../../shared/components/RelatedBooks/RelatedBooks';
import { FinalCta } from '../../../shared/components/FinalCta/FinalCta';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { BOOKS } from '../../data/books';
import { BOOK_LANDINGS } from '../../data/bookLandings';
import { formatPrice } from '../../../shared/utils/money';
import { NotFoundPage } from '../NotFoundPage/NotFoundPage';
import styles from './BookLandingPage.module.css';

/**
 * `/libros/:slug` — a single book's landing page.
 *
 * The two existing mockups diverge in their middle section and whether
 * they have an FAQ (see bookLandings.ts) — this renders whichever pieces
 * that book's content actually has, rather than forcing one fixed shape.
 */
export function BookLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const book = BOOKS.find((entry) => entry.slug === slug);
  const landing = slug ? BOOK_LANDINGS[slug] : undefined;

  if (!book || !landing) {
    return <NotFoundPage />;
  }

  return <BookLandingContent book={book} landing={landing} />;
}

function BookLandingContent({
  book,
  landing,
}: {
  book: (typeof BOOKS)[number];
  landing: (typeof BOOK_LANDINGS)[string];
}) {
  useDocumentTitle(`${book.title} · Nuestra Medicina Personal`);

  const relatedBook = BOOKS.find((entry) => entry.slug === landing.relatedSlug);

  return (
    <div className={styles.page}>
      <GradientTopBar />
      <SiteHeader />
      <BackLink to="/libros">Volver a libros</BackLink>

      <BookHero
        book={book}
        tagline={landing.tagline}
        taglineColor={landing.taglineColor}
        authorName={landing.authorName}
        description={landing.heroDescription}
        glowColor={landing.heroGlowColor}
      />

      <Synopsis eyebrowColor={landing.synopsisEyebrowColor} paragraphs={landing.synopsisParagraphs} />

      {landing.middleSection.type === 'image-text' ? (
        <ImageTextSection
          heading={landing.middleSection.heading}
          text={landing.middleSection.text}
          imageAccent={landing.middleSection.imageAccent}
          imageCaption={landing.middleSection.imageCaption}
        />
      ) : (
        <FeatureGrid heading={landing.middleSection.heading} items={landing.middleSection.items} />
      )}

      <QuoteBanner quote={landing.quote} glowSide={landing.quoteGlowSide} />

      <BookDetailsGrid
        details={[
          { label: 'Formato', value: book.format.replace(' · ', ' / ') },
          { label: 'Autor/a', value: landing.authorName },
          { label: 'Fecha de publicación', value: landing.publicationDate },
          { label: 'ISBN', value: landing.isbn },
          { label: 'Tamaño del archivo', value: landing.fileSize },
        ]}
      />

      {landing.faqs && <FaqAccordion faqs={landing.faqs} />}

      <RelatedBooks books={relatedBook ? [relatedBook] : []} />

      <FinalCta
        title={`${book.title} — ${formatPrice(book.priceMinorUnits, book.currency)}`}
        ctaHref={`/checkout/${book.slug}`}
        glowSide={landing.ctaGlowSide}
      />

      <SiteFooter />
    </div>
  );
}
