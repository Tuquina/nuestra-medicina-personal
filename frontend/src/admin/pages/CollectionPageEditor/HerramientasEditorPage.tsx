import { CollectionPageEditor } from './CollectionPageEditor';
import { buildHerramientasSeedContent, HERRAMIENTAS_SLUG } from '../../../shared/cms/collectionContent';

/** `/admin/paginas/herramientas` */
export function HerramientasEditorPage() {
  return (
    <CollectionPageEditor
      pageType="HERRAMIENTAS"
      slug={HERRAMIENTAS_SLUG}
      seed={buildHerramientasSeedContent}
      heading="Caja de herramientas"
      publicPath="/herramientas"
    />
  );
}
