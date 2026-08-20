import { GradientTopBar } from '../components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../components/SiteHeader/SiteHeader';
import { SiteFooter } from '../components/SiteFooter/SiteFooter';
import type { PublishedContentState } from './usePublishedContent';
import styles from './CmsPageState.module.css';

export function CmsPageState({ state }: { state: Exclude<PublishedContentState, { status: 'ready' }> }) {
  const loading = state.status === 'loading';
  return (
    <div className={styles.page}>
      <GradientTopBar />
      <SiteHeader />
      <main className={styles.content} role={loading ? 'status' : 'alert'}>
        <h1 className={styles.title}>{state.status === 'not-found' ? 'Contenido no disponible' : loading ? 'Cargando…' : 'No pudimos cargar esta página'}</h1>
        {!loading && (
          <button type="button" className={styles.retry} onClick={state.retry}>
            Reintentar
          </button>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
