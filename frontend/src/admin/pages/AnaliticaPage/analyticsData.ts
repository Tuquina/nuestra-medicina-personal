/**
 * Extra aggregations for `/admin/analitica`, on top of what
 * `DashboardPage/dashboardData.ts` already computes (period filtering,
 * KPIs, the sales trend chart, the book breakdown donut — all reused
 * here directly rather than duplicated).
 *
 * architecture.md §60 is explicit that this doesn't need a dedicated
 * analytics tool — "PostgreSQL puede resolver las métricas directamente
 * mediante consultas agregadas" — so every function here is written as
 * one aggregate computed from the full sales list, the shape a single
 * future `GET /api/v1/admin/analytics?range=...` response would return,
 * not several separate calls.
 */
import { BOOKS } from '../../../public-store/data/books';
import { saleBook, type Sale, type SaleStatus } from '../../data/sales';

export interface StatusBreakdownRow {
  status: SaleStatus;
  count: number;
  pct: number;
}

const STATUS_ORDER: SaleStatus[] = ['Aprobado', 'Pendiente', 'Rechazado', 'Reembolsado'];

export function computeStatusBreakdown(filtered: Sale[]): StatusBreakdownRow[] {
  const total = filtered.length;
  return STATUS_ORDER.map((status) => {
    const count = filtered.filter((sale) => sale.status === status).length;
    return { status, count, pct: total ? Math.round((count / total) * 100) : 0 };
  });
}

export interface RevenueByBookRow {
  slug: string;
  title: string;
  salesCount: number;
  revenueMinorUnits: number;
  pct: number;
}

/** Only "Aprobado" sales count as revenue — matches `computeKpis` in
 * dashboardData.ts, which doesn't filter by status today because the
 * Dashboard's KPI card is a simpler "sales in period" count; this one is
 * specifically a revenue breakdown so it has to exclude rejected/pending. */
export function computeRevenueByBook(filtered: Sale[]): RevenueByBookRow[] {
  const approved = filtered.filter((sale) => sale.status === 'Aprobado');
  const rows = BOOKS.map((book) => {
    const bookSales = approved.filter((sale) => sale.bookSlug === book.slug);
    return {
      slug: book.slug,
      title: book.title,
      salesCount: bookSales.length,
      revenueMinorUnits: bookSales.length * book.priceMinorUnits,
    };
  }).filter((row) => row.salesCount > 0);

  const totalRevenue = rows.reduce((sum, row) => sum + row.revenueMinorUnits, 0);
  return rows
    .map((row) => ({ ...row, pct: totalRevenue ? Math.round((row.revenueMinorUnits / totalRevenue) * 100) : 0 }))
    .sort((a, b) => b.revenueMinorUnits - a.revenueMinorUnits);
}

export interface AnalyticsKpis {
  revenueMinorUnits: number;
  averageOrderMinorUnits: number;
  approvalRatePct: number;
  refundedCount: number;
}

export function computeAnalyticsKpis(filtered: Sale[]): AnalyticsKpis {
  const approved = filtered.filter((sale) => sale.status === 'Aprobado');
  const revenueMinorUnits = approved.reduce((sum, sale) => sum + (saleBook(sale)?.priceMinorUnits ?? 0), 0);
  const refundedCount = filtered.filter((sale) => sale.status === 'Reembolsado').length;
  return {
    revenueMinorUnits,
    averageOrderMinorUnits: approved.length ? Math.round(revenueMinorUnits / approved.length) : 0,
    approvalRatePct: filtered.length ? Math.round((approved.length / filtered.length) * 100) : 0,
    refundedCount,
  };
}
