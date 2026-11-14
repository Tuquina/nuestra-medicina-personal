import { Link } from 'react-router-dom';
import { CollectionPageEditor } from './CollectionPageEditor';
import { buildMeditacionesSeedContent, MEDITACIONES_SLUG } from '../../../shared/cms/collectionContent';

/** `/admin/paginas/meditaciones` — the /meditaciones page's title, intro and "Próximamente" cards. */
export function MeditacionesEditorPage() {
  return (
    <CollectionPageEditor
      pageType="MEDITACIONES"
      slug={MEDITACIONES_SLUG}
      seed={buildMeditacionesSeedContent}
      heading="Portada de Meditaciones"
      publicPath="/meditaciones"
      intro={
        <>
          Acá editás el encabezado de la página /meditaciones y las tarjetas “Próximamente”. Las meditaciones
          publicadas aparecen solas al comienzo de la grilla; se crean y editan en{' '}
          <Link to="/admin/meditaciones">Contenido → Meditaciones</Link>.
        </>
      }
    />
  );
}
