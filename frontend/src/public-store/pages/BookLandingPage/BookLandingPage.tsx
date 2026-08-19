import { useParams, useSearchParams } from 'react-router-dom';
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
import { PUBLISHED_BOOKS as BOOKS } from '../../data/books';
import { formatPrice } from '../../../shared/utils/money';
import { usePublishedContent } from '../../../shared/cms/usePublishedContent';
import { buildBookLandingSeedContent, readBookLandingProps } from '../../../shared/cms/bookLandingContent';
import { NotFoundPage } from '../NotFoundPage/NotFoundPage';
import styles from './BookLandingPage.module.css';

/**
 * `/libros/:slug` — a single book's landing page.
 *
 * Storytelling content (tagline, synopsis, quote, FAQ, etc.) comes from
 * the admin's book-page editor via `shared/cms` — see
 * admin/pages/LibroFormPage/PaginaVentaTab.tsx. The catalog fields (title,
 * price, format, status) still come from `books.ts`, edited on the
 * "Información" tab — that split mirrors how the data has always been
 * modeled here (books.ts vs. bookLandings.ts).
 */
export function BookLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const book = BOOKS.find((entry) => entry.slug === slug);

  if (!book || !slug) {
    return <NotFoundPage />;
  }

  return <BookLandingContent book={book} slug={slug} />;
}

function BookLandingContent({ book, slug }: { book: (typeof BOOKS)[number]; slug: string }) {
  useDocumentTitle(`${book.title} · Nuestra Medicina Personal`);
  const [searchParams] = useSearchParams();
  const preview = searchParams.get('preview') === '1';
  const content = usePublishedContent('BOOK', slug, () => buildBookLandingSeedContent(slug), preview);
  const landing = readBookLandingProps(content);

  const relatedBook = BOOKS.find((entry) => entry.slug === landing.relatedSlug);

  return (
    <div className={styles.page}>
      {preview && (
        <div className={styles.previewBanner} role="status">
          Vista previa — estás viendo cambios sin publicar.
        </div>
      )}
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

      {landing.faqs && landing.faqs.length > 0 && <FaqAccordion faqs={landing.faqs} />}

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
