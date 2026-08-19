import { LegalDocEditorPage } from './LegalDocEditorPage';
import { buildPrivacidadSeedContent, PRIVACIDAD_SLUG } from '../../../shared/cms/legalDocContent';

/** `/admin/legal/privacidad` */
export function PrivacidadEditorPage() {
  return (
    <LegalDocEditorPage
      pageType="PRIVACIDAD"
      slug={PRIVACIDAD_SLUG}
      seed={buildPrivacidadSeedContent}
      heading="Política de Privacidad"
      publicPath="/privacidad"
    />
  );
}
