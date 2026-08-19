import { useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { toneForStatus } from '../../../shared/utils/statusTone';
import { formatPrice } from '../../../shared/utils/money';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { SalesChart } from '../DashboardPage/SalesChart';
import { SALES, PERIOD_LABELS, type Period, filterByPeriod, computeChartBars } from '../DashboardPage/dashboardData';
import { computeAnalyticsKpis, computeRevenueByBook, computeStatusBreakdown } from './analyticsData';
import dashboardStyles from '../DashboardPage/DashboardPage.module.css';
import styles from './AnaliticaPage.module.css';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: 'year', label: 'Este año' },
  { value: 'all', label: 'Todo' },
];

/**
 * `/admin/analitica` — the last of architecture.md §6's "future
 * extensions". Deeper than the Dashboard's KPI strip, but still no
 * dedicated analytics tool (§60): everything here is one aggregate over
 * the same `SALES` mock data the Dashboard uses, shaped like a single
 * future `GET /api/v1/admin/analytics?range=...` response.
 */
export function AnaliticaPage() {
  useDocumentTitle('Analítica · Admin · Nuestra Medicina Personal');

  const [period, setPeriod] = useState<Period>('year');
  const periodLabel = PERIOD_LABELS[period];

  const filtered = filterByPeriod(SALES, period);
  const kpis = computeAnalyticsKpis(filtered);
  const chartBars = computeChartBars(filtered, period);
  const statusBreakdown = computeStatusBreakdown(filtered);
  const revenueByBook = computeRevenueByBook(filtered);

  return (
    <AdminLayout title="Analítica">
      <div className={[dashboardStyles.panel, dashboardStyles.filterBar].join(' ')}>
        <div className={dashboardStyles.filterGroup}>
          <span className={dashboardStyles.filterLabel}>Período</span>
          <div className={dashboardStyles.segmented}>
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={[
                  dashboardStyles.segmentButton,
                  period === option.value ? dashboardStyles.segmentButtonActive : '',
                ].join(' ')}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={dashboardStyles.kpiGrid}>
        <div className={[dashboardStyles.panel, dashboardStyles.kpiCard].join(' ')}>
          <p className={dashboardStyles.kpiLabel}>Ingresos ({periodLabel})</p>
          <p className={dashboardStyles.kpiValue}>{formatPrice(kpis.revenueMinorUnits)}</p>
        </div>
        <div className={[dashboardStyles.panel, dashboardStyles.kpiCard].join(' ')}>
          <p className={dashboardStyles.kpiLabel}>Ticket promedio</p>
          <p className={dashboardStyles.kpiValue}>{formatPrice(kpis.averageOrderMinorUnits)}</p>
        </div>
        <div className={[dashboardStyles.panel, dashboardStyles.kpiCard].join(' ')}>
          <p className={dashboardStyles.kpiLabel}>Tasa de aprobación</p>
          <p className={dashboardStyles.kpiValue}>{kpis.approvalRatePct}%</p>
        </div>
        <div className={[dashboardStyles.panel, dashboardStyles.kpiCard].join(' ')}>
          <p className={dashboardStyles.kpiLabel}>Reembolsos ({periodLabel})</p>
          <p className={dashboardStyles.kpiValue}>{kpis.refundedCount}</p>
        </div>
      </div>

      <div className={styles.twoCol}>
        <SalesChart title={`Evolución de ventas — ${periodLabel}`} bars={chartBars} />

        <div className={[dashboardStyles.panel, dashboardStyles.panelInner].join(' ')}>
          <h2 className={dashboardStyles.panelTitle}>Ventas por estado — {periodLabel}</h2>
          {statusBreakdown.every((row) => row.count === 0) ? (
            <p className={dashboardStyles.emptyRow}>Sin ventas en este período.</p>
          ) : (
            <div className={styles.statusBars}>
              {statusBreakdown.map((row) => (
                <div key={row.status} className={styles.statusBarRow}>
                  <StatusBadge tone={toneForStatus(row.status)}>{row.status}</StatusBadge>
                  <div className={styles.statusBarTrack}>
                    <div className={styles.statusBarFill} style={{ width: `${row.pct}%` }} />
                  </div>
                  <span className={styles.statusBarValue}>
                    {row.count} · {row.pct}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={[dashboardStyles.panel, dashboardStyles.tableCard].join(' ')}>
        <div className={dashboardStyles.tableHeader}>
          <h2 className={dashboardStyles.panelTitle} style={{ margin: 0 }}>
            Ingresos por libro — {periodLabel}
          </h2>
        </div>
        {revenueByBook.length === 0 ? (
          <p className={dashboardStyles.emptyRow}>Sin ventas aprobadas en este período.</p>
        ) : (
          <table className={dashboardStyles.table}>
            <thead>
              <tr>
                <th>Libro</th>
                <th>Ventas</th>
                <th>Ingresos</th>
                <th>% del total</th>
              </tr>
            </thead>
            <tbody>
              {revenueByBook.map((row) => (
                <tr key={row.slug}>
                  <td>{row.title}</td>
                  <td>{row.salesCount}</td>
                  <td>{formatPrice(row.revenueMinorUnits)}</td>
                  <td>{row.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
