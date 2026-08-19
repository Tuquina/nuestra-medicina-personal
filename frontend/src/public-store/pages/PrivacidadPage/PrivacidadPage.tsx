import { useSearchParams } from 'react-router-dom';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { LegalPage } from '../../../shared/components/LegalPage/LegalPage';
import { usePublishedContent } from '../../../shared/cms/usePublishedContent';
import { buildPrivacidadSeedContent, PRIVACIDAD_SLUG, readLegalDocProps } from '../../../shared/cms/legalDocContent';
import { LegalDocBody } from '../../../shared/cms/legalDocRenderer';

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
  const content = usePublishedContent('PRIVACIDAD', PRIVACIDAD_SLUG, buildPrivacidadSeedContent, preview);
  const doc = readLegalDocProps(content);

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
