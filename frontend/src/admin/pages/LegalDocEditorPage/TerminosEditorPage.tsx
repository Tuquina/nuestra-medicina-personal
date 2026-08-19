import { LegalDocEditorPage } from './LegalDocEditorPage';
import { buildTerminosSeedContent, TERMINOS_SLUG } from '../../../shared/cms/legalDocContent';

/** `/admin/legal/terminos` */
export function TerminosEditorPage() {
  return (
    <LegalDocEditorPage
      pageType="TERMINOS"
      slug={TERMINOS_SLUG}
      seed={buildTerminosSeedContent}
      heading="Términos y Condiciones"
      publicPath="/terminos"
    />
  );
}
