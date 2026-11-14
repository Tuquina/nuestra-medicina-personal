import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { apiRequest } from '../../../shared/api/client';
import { adminPagesByTypeUrl } from '../../../shared/config/api';
import { relativeDaysEs } from '../../../shared/utils/relativeTime';
import styles from './MeditacionesAdmin.module.css';

interface PageListItem {
  id: string;
  slug: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED';
  hasUnpublishedChanges: boolean;
  updatedAt: string;
  publishedAt: string | null;
}

type ListState =
  | { status: 'loading' }
  | { status: 'ready'; items: PageListItem[] }
  | { status: 'error' };

function statusOf(item: PageListItem): { label: string; tone: 'success' | 'pending' | 'neutral' } {
  if (item.status !== 'PUBLISHED') return { label: 'Borrador', tone: 'neutral' };
  if (item.hasUnpublishedChanges) return { label: 'Cambios sin publicar', tone: 'pending' };
  return { label: 'Publicada', tone: 'success' };
}

/** `/admin/meditaciones` — every meditation page, drafts included. */
export function MeditacionesListPage() {
  useDocumentTitle('Meditaciones · Admin · Nuestra Medicina Personal');
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ items: PageListItem[] }>(adminPagesByTypeUrl('MEDITACION'), { signal: controller.signal })
      .then((response) => setState({ status: 'ready', items: response.items }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  };

  return (
    <AdminLayout
      title="Meditaciones"
      headerActions={
        <Button variant="primary" to="/admin/meditaciones/nueva">
          Nueva meditación
        </Button>
      }
    >
      <div className={styles.panel}>
        <p className={styles.intro}>
          Cada meditación tiene su propia página en <code>/meditaciones/…</code> y su tarjeta en la sección
          Meditaciones. Se publica cuando vos lo decidas; los borradores no se ven en el sitio.
        </p>

        {state.status === 'loading' ? (
          <p className={styles.emptyState} role="status">
            Cargando meditaciones…
          </p>
        ) : state.status === 'error' ? (
          <div className={styles.emptyState} role="alert">
            <p>No pudimos cargar las meditaciones.</p>
            <Button variant="secondary" onClick={retry}>
              Reintentar
            </Button>
          </div>
        ) : state.items.length === 0 ? (
          <p className={styles.emptyState}>Todavía no hay meditaciones. Creá la primera con “Nueva meditación”.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Dirección</th>
                  <th>Estado</th>
                  <th>Última actualización</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((item) => {
                  const status = statusOf(item);
                  return (
                    <tr key={item.id}>
                      <td className={styles.titleCell}>{item.title}</td>
                      <td className={styles.slugCell}>/meditaciones/{item.slug}</td>
                      <td>
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </td>
                      <td className={styles.dateCell}>{relativeDaysEs(item.updatedAt, new Date())}</td>
                      <td className={styles.actions}>
                        <Link to={`/admin/meditaciones/${item.slug}/editar`} className={styles.editLink}>
                          Editar
                        </Link>
                        {item.status === 'PUBLISHED' && (
                          <a href={`/meditaciones/${item.slug}`} target="_blank" rel="noreferrer" className={styles.secondaryLink}>
                            Ver
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
