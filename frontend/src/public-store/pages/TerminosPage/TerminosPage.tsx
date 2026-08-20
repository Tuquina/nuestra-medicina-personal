import { useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { LegalPage } from '../../../shared/components/LegalPage/LegalPage';
import { usePublishedContent } from '../../../shared/cms/usePublishedContent';
import { readLegalDocProps, TERMINOS_SLUG } from '../../../shared/cms/legalDocContent';
import { LegalDocBody } from '../../../shared/cms/legalDocRenderer';
import { CmsPageState } from '../../../shared/cms/CmsPageState';

/**
 * `/terminos` — Términos y Condiciones. Content comes from the admin's
 * "Legal" editor via shared/cms (see legalDocContent.tsx for the
 * markdown-lite body dialect and the original transcription notes on
 * the Argentine law this was written against).
 */
export function TerminosPage() {
  useDocumentTitle('Términos y Condiciones · Nuestra Medicina Personal');
  const [searchParams] = useSearchParams();
  const preview = searchParams.get('preview') === '1';
  const page = usePublishedContent('TERMINOS', TERMINOS_SLUG, preview);
  if (page.status !== 'ready') return <CmsPageState state={page} />;
  const doc = readLegalDocProps(page.content);

  return (
    <LegalPage
      eyebrow="Legal"
      title={doc.title}
      updatedLabel={doc.updatedLabel}
      sections={doc.sections}
      preview={preview}
    >
      <LegalDocBody doc={doc} />
    </LegalPage>
  );
}
