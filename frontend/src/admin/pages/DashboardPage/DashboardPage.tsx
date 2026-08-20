import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { formatPrice } from '../../../shared/utils/money';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { apiRequest } from '../../../shared/api/client';
import { ADMIN_BOOKS_URL, ADMIN_DASHBOARD_URL } from '../../../shared/config/api';
import type { AdminBook, AdminBookList } from '../../books/types';
import type { DashboardResponse, ReportingRange } from '../../backoffice/types';
import { formatTrendLabel, PERIOD_LABELS } from '../../backoffice/presentation';
import { SalesChart } from './SalesChart';
import { TopBooksDonut } from './TopBooksDonut';
import { PublicationStatus } from './PublicationStatus';
import { RecentSalesTable } from './RecentSalesTable';
import styles from './DashboardPage.module.css';

const PERIOD_OPTIONS: { value: ReportingRange; label: string }[] = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: 'year', label: 'Este año' },
  { value: 'all', label: 'Todo' },
];

type DashboardState =
  | { status: 'loading'; books: AdminBook[] }
  | { status: 'ready'; dashboard: DashboardResponse; books: AdminBook[] }
  | { status: 'error'; books: AdminBook[] };

export function DashboardPage() {
  useDocumentTitle('Dashboard · Admin · Nuestra Medicina Personal');
  const [period, setPeriod] = useState<ReportingRange>('year');
  const [bookSlug, setBookSlug] = useState('all');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DashboardState>({ status: 'loading', books: [] });

  const retry = useCallback(() => {
    setState((current) => ({ status: 'loading', books: current.books }));
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ range: period });
    if (bookSlug !== 'all') params.set('bookSlug', bookSlug);
    Promise.all([
      apiRequest<DashboardResponse>(`${ADMIN_DASHBOARD_URL}?${params}`, { signal: controller.signal }),
      apiRequest<AdminBookList>(ADMIN_BOOKS_URL, { signal: controller.signal }),
    ])
      .then(([dashboard, books]) => setState({ status: 'ready', dashboard, books: books.items }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState((current) => ({ status: 'error', books: current.books }));
      });
    return () => controller.abort();
  }, [attempt, bookSlug, period]);

  const books = state.books;
  const periodLabel = PERIOD_LABELS[period];

  return (
    <AdminLayout title="Dashboard" headerActions={<Button variant="primary" to="/admin/libros/nuevo">Nuevo libro</Button>}>
      <div className={[styles.panel, styles.filterBar].join(' ')}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Período</span>
          <div className={styles.segmented}>
            {PERIOD_OPTIONS.map((option) => (
              <button key={option.value} type="button" onClick={() => setPeriod(option.value)} className={[styles.segmentButton, period === option.value ? styles.segmentButtonActive : ''].join(' ')}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.filterDivider} />
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Libro</span>
          <div className={styles.chipRow}>
            <button type="button" onClick={() => setBookSlug('all')} className={[styles.chipButton, bookSlug === 'all' ? styles.chipButtonActive : ''].join(' ')}>Todos</button>
            {books.filter((book) => book.status === 'PUBLISHED').map((book) => (
              <button key={book.slug} type="button" onClick={() => setBookSlug(book.slug)} className={[styles.chipButton, bookSlug === book.slug ? styles.chipButtonActive : ''].join(' ')}>{book.title}</button>
            ))}
          </div>
        </div>
      </div>
      {state.status === 'loading' ? (
        <div className={[styles.panel, styles.feedback].join(' ')} role="status">Cargando métricas…</div>
      ) : state.status === 'error' ? (
        <div className={[styles.panel, styles.feedback].join(' ')} role="alert"><p>No pudimos cargar el dashboard.</p><Button variant="secondary" onClick={retry}>Reintentar</Button></div>
      ) : (
        <DashboardContent dashboard={state.dashboard} books={books} periodLabel={periodLabel} />
      )}
    </AdminLayout>
  );
}

function DashboardContent({ dashboard, books, periodLabel }: { dashboard: DashboardResponse; books: AdminBook[]; periodLabel: string }) {
  const totalTopSales = dashboard.topBooks.reduce((sum, book) => sum + book.salesCount, 0);
  const slices = dashboard.topBooks.map((book) => ({ slug: book.bookSlug, title: book.bookTitle, count: book.salesCount, pct: totalTopSales ? Math.round((book.salesCount / totalTopSales) * 100) : 0 }));
  const bars = dashboard.trend.map((point) => ({ label: formatTrendLabel(point.periodStart, dashboard.range), count: point.salesCount }));
  return (
    <>
      <div className={styles.kpiGrid}>
        <Kpi label={`Ventas (${periodLabel})`} value={String(dashboard.kpis.approvedSalesCount)} />
        <Kpi label={`Ingresos (${periodLabel})`} value={formatPrice(dashboard.kpis.revenueMinorUnits, dashboard.currency)} />
        <Kpi label={`Compradores (${periodLabel})`} value={String(dashboard.kpis.buyersCount)} />
        <Kpi label="Libros publicados" value={String(dashboard.books.publishedCount)} />
        <Kpi label="Libros en borrador" value={String(dashboard.books.draftCount)} />
      </div>
      <div className={styles.panelGrid}>
        <SalesChart title={`Evolución de ventas — ${periodLabel}`} bars={bars} />
        <TopBooksDonut title={`Libros más vendidos — ${periodLabel}`} slices={slices} total={totalTopSales} />
        <PublicationStatus books={books} />
      </div>
      <RecentSalesTable title={`Ventas recientes — ${periodLabel}`} sales={dashboard.recentSales} />
      <div className={[styles.panel, styles.actionsCard].join(' ')}>
        <h2 className={styles.panelTitle}>Acciones rápidas</h2>
        <div className={styles.actionsRow}>
          <Button variant="primary" to="/admin/libros/nuevo">Nuevo libro</Button>
          <Button variant="secondary" to="/admin/paginas">Editar página de inicio</Button>
          <Button variant="secondary" to="/admin/ventas">Ver ventas</Button>
          <Button variant="secondary" to="/admin/multimedia">Subir imagen</Button>
        </div>
      </div>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className={[styles.panel, styles.kpiCard].join(' ')}><p className={styles.kpiLabel}>{label}</p><p className={styles.kpiValue}>{value}</p></div>;
}
