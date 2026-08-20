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
import type { Book } from '../../data/books';
import { useCatalog } from '../../catalog/useCatalog';
import { formatPrice } from '../../../shared/utils/money';
import { usePublishedContent } from '../../../shared/cms/usePublishedContent';
import { readBookLandingProps } from '../../../shared/cms/bookLandingContent';
import { CmsPageState } from '../../../shared/cms/CmsPageState';
import { NotFoundPage } from '../NotFoundPage/NotFoundPage';
import styles from './BookLandingPage.module.css';

/**
 * `/libros/:slug` — a single book's landing page.
 *
 * Storytelling content (tagline, synopsis, quote, FAQ, etc.) comes from
 * the admin's book-page editor via `shared/cms` — see
 * admin/pages/LibroFormPage/PaginaVentaTab.tsx. The catalog fields (title,
 * price, format and status) come from the public books API, while the CMS
 * owns the editorial storytelling blocks.
 */
export function BookLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const catalog = useCatalog();
  const book = catalog.status === 'ready' ? catalog.books.find((entry) => entry.slug === slug) : undefined;

  useDocumentTitle(
    book ? `${book.title} · Nuestra Medicina Personal` : 'Libro · Nuestra Medicina Personal',
  );

  if (catalog.status !== 'ready') {
    return (
      <div className={styles.page}>
        <GradientTopBar />
        <SiteHeader />
        <main className={styles.resourceState} role={catalog.status === 'error' ? 'alert' : 'status'}>
          <p>{catalog.status === 'loading' ? 'Cargando libro…' : 'No pudimos cargar el libro.'}</p>
          {catalog.status === 'error' && (
            <button type="button" className={styles.retryButton} onClick={catalog.retry}>
              Reintentar
            </button>
          )}
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!book || !slug) {
    return <NotFoundPage />;
  }

  return <BookLandingContent book={book} slug={slug} />;
}

function BookLandingContent({ book, slug }: { book: Book; slug: string }) {
  const [searchParams] = useSearchParams();
  const preview = searchParams.get('preview') === '1';
  const page = usePublishedContent('BOOK', slug, preview);
  const catalog = useCatalog();
  if (page.status !== 'ready') return <CmsPageState state={page} />;
  const landing = readBookLandingProps(page.content);

  const relatedBook = catalog.status === 'ready'
    ? catalog.books.find((entry) => entry.slug === landing.relatedSlug)
    : undefined;

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
