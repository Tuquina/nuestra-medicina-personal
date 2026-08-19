import { CollectionPageEditor } from './CollectionPageEditor';
import { buildMeditacionesSeedContent, MEDITACIONES_SLUG } from '../../../shared/cms/collectionContent';

/** `/admin/paginas/meditaciones` */
export function MeditacionesEditorPage() {
  return (
    <CollectionPageEditor
      pageType="MEDITACIONES"
      slug={MEDITACIONES_SLUG}
      seed={buildMeditacionesSeedContent}
      heading="Meditaciones"
      publicPath="/meditaciones"
    />
  );
}
