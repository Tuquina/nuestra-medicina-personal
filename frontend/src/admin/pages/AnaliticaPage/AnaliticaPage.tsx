import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { toneForStatus } from '../../../shared/utils/statusTone';
import { formatPrice } from '../../../shared/utils/money';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { apiRequest } from '../../../shared/api/client';
import { ADMIN_DASHBOARD_URL } from '../../../shared/config/api';
import type { DashboardResponse, ReportingRange } from '../../backoffice/types';
import { formatTrendLabel, PERIOD_LABELS } from '../../backoffice/presentation';
import { SalesChart } from '../DashboardPage/SalesChart';
import dashboardStyles from '../DashboardPage/DashboardPage.module.css';
import styles from './AnaliticaPage.module.css';

const PERIOD_OPTIONS: Array<{ value: ReportingRange; label: string }> = [{ value: '7d', label: '7 días' }, { value: '30d', label: '30 días' }, { value: 'year', label: 'Este año' }, { value: 'all', label: 'Todo' }];

export function AnaliticaPage() {
  useDocumentTitle('Analítica · Admin · Nuestra Medicina Personal');
  const [period, setPeriod] = useState<ReportingRange>('year');
  const [state, setState] = useState<{ status: 'loading' | 'error' | 'ready'; data?: DashboardResponse }>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<DashboardResponse>(`${ADMIN_DASHBOARD_URL}?${new URLSearchParams({ range: period })}`, { signal: controller.signal })
      .then((data) => setState({ status: 'ready', data }))
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) setState({ status: 'error' }); });
    return () => controller.abort();
  }, [attempt, period]);
  const changePeriod = (value: ReportingRange) => { setState({ status: 'loading' }); setPeriod(value); };
  const retry = () => { setState({ status: 'loading' }); setAttempt((value) => value + 1); };

  return <AdminLayout title="Analítica"><div className={[dashboardStyles.panel, dashboardStyles.filterBar].join(' ')}><div className={dashboardStyles.filterGroup}><span className={dashboardStyles.filterLabel}>Período</span><div className={dashboardStyles.segmented}>{PERIOD_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => changePeriod(option.value)} className={[dashboardStyles.segmentButton, period === option.value ? dashboardStyles.segmentButtonActive : ''].join(' ')}>{option.label}</button>)}</div></div></div>
    {state.status === 'loading' ? <div className={[dashboardStyles.panel, dashboardStyles.emptyRow].join(' ')}>Cargando analítica…</div> : state.status === 'error' || !state.data ? <div className={[dashboardStyles.panel, dashboardStyles.emptyRow].join(' ')}><p>No pudimos cargar la analítica.</p><Button variant="secondary" onClick={retry}>Reintentar</Button></div> : <AnalyticsContent data={state.data} />}
  </AdminLayout>;
}

function AnalyticsContent({ data }: { data: DashboardResponse }) {
  const totalStatuses = data.paymentStatuses.reduce((sum, row) => sum + row.count, 0);
  const approved = data.paymentStatuses.find((row) => row.status === 'APPROVED')?.count ?? 0;
  const refunded = data.paymentStatuses.find((row) => row.status === 'REFUNDED')?.count ?? 0;
  const statuses = data.paymentStatuses.map((row) => ({ ...row, pct: totalStatuses ? Math.round((row.count / totalStatuses) * 100) : 0 }));
  const topRevenue = data.topBooks.reduce((sum, row) => sum + row.revenueMinorUnits, 0);
  const bars = data.trend.map((row) => ({ label: formatTrendLabel(row.periodStart, data.range), count: row.salesCount }));
  const label = PERIOD_LABELS[data.range];
  return <><div className={dashboardStyles.kpiGrid}><Kpi label={`Ingresos (${label})`} value={formatPrice(data.kpis.revenueMinorUnits, data.currency)} /><Kpi label="Ticket promedio" value={formatPrice(data.kpis.averageOrderMinorUnits, data.currency)} /><Kpi label="Tasa de aprobación" value={`${totalStatuses ? Math.round((approved / totalStatuses) * 100) : 0}%`} /><Kpi label={`Reembolsos (${label})`} value={String(refunded)} /></div>
    <div className={styles.twoCol}><SalesChart title={`Evolución de ventas — ${label}`} bars={bars} /><div className={[dashboardStyles.panel, dashboardStyles.panelInner].join(' ')}><h2 className={dashboardStyles.panelTitle}>Ventas por estado — {label}</h2>{statuses.length === 0 ? <p className={dashboardStyles.emptyRow}>Sin ventas en este período.</p> : <div className={styles.statusBars}>{statuses.map((row) => <div key={row.status} className={styles.statusBarRow}><StatusBadge tone={toneForStatus(row.status)}>{row.status}</StatusBadge><div className={styles.statusBarTrack}><div className={styles.statusBarFill} style={{ width: `${row.pct}%` }} /></div><span className={styles.statusBarValue}>{row.count} · {row.pct}%</span></div>)}</div>}</div></div>
    <div className={[dashboardStyles.panel, dashboardStyles.tableCard].join(' ')}><div className={dashboardStyles.tableHeader}><h2 className={dashboardStyles.panelTitle}>Ingresos por libro — {label}</h2></div>{data.topBooks.length === 0 ? <p className={dashboardStyles.emptyRow}>Sin ventas aprobadas en este período.</p> : <div className={dashboardStyles.tableScroll}><table className={dashboardStyles.table}><thead><tr><th>Libro</th><th>Ventas</th><th>Ingresos</th><th>% del total</th></tr></thead><tbody>{data.topBooks.map((row) => <tr key={row.bookId}><td>{row.bookTitle}</td><td>{row.salesCount}</td><td>{formatPrice(row.revenueMinorUnits, data.currency)}</td><td>{topRevenue ? Math.round((row.revenueMinorUnits / topRevenue) * 100) : 0}%</td></tr>)}</tbody></table></div>}</div></>;
}

function Kpi({ label, value }: { label: string; value: string }) { return <div className={[dashboardStyles.panel, dashboardStyles.kpiCard].join(' ')}><p className={dashboardStyles.kpiLabel}>{label}</p><p className={dashboardStyles.kpiValue}>{value}</p></div>; }
