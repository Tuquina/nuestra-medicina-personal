import { PUBLISHED_BOOKS } from '../../../public-store/data/books';
import { SALES, saleBook, type Sale } from '../../data/sales';
import { ADMIN_NOW } from '../../adminNow';

export type Period = '7d' | '30d' | 'year' | 'all';

export const PERIOD_LABELS: Record<Period, string> = {
  '7d': 'últimos 7 días',
  '30d': 'últimos 30 días',
  year: 'este año',
  all: 'todo el período',
};


function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function inPeriod(dateISO: string, period: Period, now: Date): boolean {
  const d = new Date(dateISO);
  if (period === 'all') return true;
  if (period === 'year') return d.getFullYear() === now.getFullYear();
  const diff = daysBetween(now, d);
  if (period === '7d') return diff >= 0 && diff < 7;
  if (period === '30d') return diff >= 0 && diff < 30;
  return true;
}

export function filterByPeriod(sales: Sale[], period: Period, now: Date = ADMIN_NOW): Sale[] {
  return sales.filter((sale) => inPeriod(sale.dateISO, period, now));
}

export function filterByBook(sales: Sale[], bookSlug: string | 'all'): Sale[] {
  return bookSlug === 'all' ? sales : sales.filter((sale) => sale.bookSlug === bookSlug);
}

export interface DashboardKpis {
  salesCount: number;
  revenueMinorUnits: number;
  buyersCount: number;
}

export function computeKpis(filtered: Sale[]): DashboardKpis {
  const revenueMinorUnits = filtered.reduce((sum, sale) => {
    const book = saleBook(sale);
    return sum + (book?.priceMinorUnits ?? 0);
  }, 0);
  return {
    salesCount: filtered.length,
    revenueMinorUnits,
    buyersCount: new Set(filtered.map((sale) => sale.client)).size,
  };
}

export interface DonutSlice {
  slug: string;
  title: string;
  count: number;
  pct: number;
}

/**
 * Book breakdown ignores the book filter (it *is* the book breakdown) —
 * respects period only. Only published books can have sales, so drafts
 * never appear here even though they exist in the wider BOOKS array.
 */
export function computeDonut(byPeriod: Sale[]): { slices: DonutSlice[]; total: number } {
  const slices = PUBLISHED_BOOKS.map((book) => ({
    slug: book.slug,
    title: book.title,
    count: byPeriod.filter((sale) => sale.bookSlug === book.slug).length,
  }));
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  return {
    total,
    slices: slices.map((slice) => ({ ...slice, pct: total ? Math.round((slice.count / total) * 100) : 0 })),
  };
}

export interface ChartBar {
  label: string;
  count: number;
}

export function computeChartBars(filtered: Sale[], period: Period, now: Date = ADMIN_NOW): ChartBar[] {
  if (period === '7d' || period === '30d') {
    const days = period === '7d' ? 7 : 30;
    const groups = period === '7d' ? days : 10;
    const perGroup = days / groups;
    const bars: ChartBar[] = [];
    for (let g = 0; g < groups; g++) {
      const startOffset = days - (g + 1) * perGroup;
      const count = filtered.filter((sale) => {
        const diff = daysBetween(now, new Date(sale.dateISO));
        return diff >= startOffset && diff < startOffset + perGroup;
      }).length;
      const d = new Date(now);
      d.setDate(d.getDate() - Math.round(startOffset));
      bars.push({
        count,
        label: period === '7d' ? String(d.getDate()) : g % 3 === 0 ? String(d.getDate()) : '',
      });
    }
    return bars;
  }

  if (period === 'year') {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago'];
    return months.map((label, i) => ({
      label,
      count: filtered.filter((sale) => {
        const d = new Date(sale.dateISO);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === i;
      }).length,
    }));
  }

  const years = ['2025', '2026'];
  return years.map((year) => ({
    label: year,
    count: filtered.filter((sale) => sale.dateISO.startsWith(year)).length,
  }));
}

export function recentSales(filtered: Sale[], limit = 5): Sale[] {
  return [...filtered].sort((a, b) => b.dateISO.localeCompare(a.dateISO)).slice(0, limit);
}

export function formatSaleDate(dateISO: string): string {
  return new Date(dateISO).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export { SALES };
