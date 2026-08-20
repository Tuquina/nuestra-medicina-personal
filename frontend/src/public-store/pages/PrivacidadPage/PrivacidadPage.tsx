import { useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { LegalPage } from '../../../shared/components/LegalPage/LegalPage';
import { usePublishedContent } from '../../../shared/cms/usePublishedContent';
import { PRIVACIDAD_SLUG, readLegalDocProps } from '../../../shared/cms/legalDocContent';
import { LegalDocBody } from '../../../shared/cms/legalDocRenderer';
import { CmsPageState } from '../../../shared/cms/CmsPageState';

/**
 * `/privacidad` — Política de Privacidad. Content comes from the admin's
 * "Legal" editor via shared/cms (see legalDocContent.tsx for the
 * markdown-lite body dialect and the original transcription notes on
 * the Argentine law this was written against).
 */
export function PrivacidadPage() {
  useDocumentTitle('Política de Privacidad · Nuestra Medicina Personal');
  const [searchParams] = useSearchParams();
  const preview = searchParams.get('preview') === '1';
  const page = usePublishedContent('PRIVACIDAD', PRIVACIDAD_SLUG, preview);
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
