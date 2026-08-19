import { useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { formatPrice } from '../../../shared/utils/money';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { BOOKS } from '../../../public-store/data/books';
import { SalesChart } from './SalesChart';
import { TopBooksDonut } from './TopBooksDonut';
import { PublicationStatus } from './PublicationStatus';
import { RecentSalesTable } from './RecentSalesTable';
import {
  SALES,
  PERIOD_LABELS,
  type Period,
  filterByPeriod,
  filterByBook,
  computeKpis,
  computeDonut,
  computeChartBars,
  recentSales,
} from './dashboardData';
import styles from './DashboardPage.module.css';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: 'year', label: 'Este año' },
  { value: 'all', label: 'Todo' },
];

/** `/admin` — Dashboard, built from Admin Dashboard.dc.html. */
export function DashboardPage() {
  useDocumentTitle('Dashboard · Admin · Nuestra Medicina Personal');

  const [period, setPeriod] = useState<Period>('year');
  const [bookSlug, setBookSlug] = useState<string>('all');

  const periodLabel = PERIOD_LABELS[period];
  const byPeriod = filterByPeriod(SALES, period);
  const filtered = filterByBook(byPeriod, bookSlug);

  const kpis = computeKpis(filtered);
  const donut = computeDonut(byPeriod);
  const chartBars = computeChartBars(filtered, period);
  const recent = recentSales(filtered);

  const publishedCount = BOOKS.filter((book) => book.status === 'PUBLISHED').length;
  const draftCount = BOOKS.filter((book) => book.status === 'DRAFT').length;

  return (
    <AdminLayout
      title="Dashboard"
      headerActions={
        <Button variant="primary" to="/admin/libros/nuevo">
          Nuevo libro
        </Button>
      }
    >
      {/* FILTER BAR */}
      <div className={[styles.panel, styles.filterBar].join(' ')}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Período</span>
          <div className={styles.segmented}>
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={[styles.segmentButton, period === option.value ? styles.segmentButtonActive : ''].join(
                  ' ',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.filterDivider} />

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Libro</span>
          <div className={styles.chipRow}>
            <button
              type="button"
              onClick={() => setBookSlug('all')}
              className={[styles.chipButton, bookSlug === 'all' ? styles.chipButtonActive : ''].join(' ')}
            >
              Todos
            </button>
            {BOOKS.filter((book) => book.status === 'PUBLISHED').map((book) => (
              <button
                key={book.slug}
                type="button"
                onClick={() => setBookSlug(book.slug)}
                className={[styles.chipButton, bookSlug === book.slug ? styles.chipButtonActive : ''].join(' ')}
              >
                {book.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className={styles.kpiGrid}>
        <div className={[styles.panel, styles.kpiCard].join(' ')}>
          <p className={styles.kpiLabel}>Ventas ({periodLabel})</p>
          <p className={styles.kpiValue}>{kpis.salesCount}</p>
        </div>
        <div className={[styles.panel, styles.kpiCard].join(' ')}>
          <p className={styles.kpiLabel}>Ingresos ({periodLabel})</p>
          <p className={styles.kpiValue}>{formatPrice(kpis.revenueMinorUnits)}</p>
        </div>
        <div className={[styles.panel, styles.kpiCard].join(' ')}>
          <p className={styles.kpiLabel}>Compradores ({periodLabel})</p>
          <p className={styles.kpiValue}>{kpis.buyersCount}</p>
        </div>
        <div className={[styles.panel, styles.kpiCard].join(' ')}>
          <p className={styles.kpiLabel}>Libros publicados</p>
          <p className={styles.kpiValue}>{publishedCount}</p>
        </div>
        <div className={[styles.panel, styles.kpiCard].join(' ')}>
          <p className={styles.kpiLabel}>Libros en borrador</p>
          <p className={styles.kpiValue}>{draftCount}</p>
        </div>
      </div>

      {/* CHART + DONUT + STATUS */}
      <div className={styles.panelGrid}>
        <SalesChart title={`Evolución de ventas — ${periodLabel}`} bars={chartBars} />
        <TopBooksDonut title={`Libros más vendidos — ${periodLabel}`} slices={donut.slices} total={donut.total} />
        <PublicationStatus />
      </div>

      <RecentSalesTable title={`Ventas recientes — ${periodLabel}`} sales={recent} />

      {/* QUICK ACTIONS */}
      <div className={[styles.panel, styles.actionsCard].join(' ')}>
        <h2 className={styles.panelTitle}>Acciones rápidas</h2>
        <div className={styles.actionsRow}>
          <Button variant="primary" to="/admin/libros/nuevo">
            Nuevo libro
          </Button>
          <Button variant="secondary" to="/admin/paginas">
            Editar página de inicio
          </Button>
          <Button variant="secondary" to="/admin/ventas">
            Ver ventas
          </Button>
          <Button variant="secondary" to="/admin/multimedia">
            Subir imagen
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
