import { useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { toneForStatus } from '../../../shared/utils/statusTone';
import { formatPrice } from '../../../shared/utils/money';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { SALES, saleBook, type SaleStatus } from '../../data/sales';
import { formatSaleDate } from '../DashboardPage/dashboardData';
import { ADMIN_NOW } from '../../adminNow';
import styles from './VentasPage.module.css';

const STATUS_OPTIONS: (SaleStatus | 'Todos los estados')[] = [
  'Todos los estados',
  'Aprobado',
  'Pendiente',
  'Rechazado',
  'Reembolsado',
];

type DateFilter = 'Todas las fechas' | 'Últimos 7 días' | 'Últimos 30 días';
const DATE_OPTIONS: DateFilter[] = ['Todas las fechas', 'Últimos 7 días', 'Últimos 30 días'];

function withinDateFilter(dateISO: string, filter: DateFilter): boolean {
  if (filter === 'Todas las fechas') return true;
  const diffDays = Math.round((ADMIN_NOW.getTime() - new Date(dateISO).getTime()) / 86_400_000);
  return filter === 'Últimos 7 días' ? diffDays >= 0 && diffDays < 7 : diffDays >= 0 && diffDays < 30;
}

/** `/admin/ventas` — every sale, with a click-through detail view, built from Admin Ventas.dc.html. */
export function VentasPage() {
  useDocumentTitle('Ventas · Admin · Nuestra Medicina Personal');

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>('Todos los estados');
  const [dateFilter, setDateFilter] = useState<DateFilter>('Todas las fechas');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = SALES.find((sale) => sale.id === selectedId);

  if (selected) {
    const book = saleBook(selected);
    return (
      <AdminLayout title="Ventas">
        <button type="button" className={styles.backButton} onClick={() => setSelectedId(null)}>
          ← Volver a ventas
        </button>
        <div className={styles.detailCard}>
          <div className={styles.detailHeader}>
            <h2 className={styles.detailHeading}>Venta #{selected.id}</h2>
            <StatusBadge tone={toneForStatus(selected.status)}>{selected.status}</StatusBadge>
          </div>
          <div className={styles.detailRows}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Fecha</span>
              <span className={styles.detailValue}>{formatSaleDate(selected.dateISO)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Cliente</span>
              <span className={styles.detailValue}>{selected.client}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Correo</span>
              <span className={styles.detailValue}>{selected.email}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Libro</span>
              <span className={styles.detailValue}>{book?.title ?? '—'}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Precio</span>
              <span className={styles.detailValue}>
                {book ? formatPrice(book.priceMinorUnits, book.currency) : '—'}
              </span>
            </div>
            <div className={[styles.detailRow, styles.detailRowDivider].join(' ')}>
              <span className={styles.detailLabel}>Estado de la orden</span>
              <span className={styles.detailValue}>{selected.status}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Estado del pago</span>
              <span className={styles.detailValue}>{selected.status}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>ID de Mercado Pago</span>
              <span className={[styles.detailValue, styles.mono].join(' ')}>{selected.mpId}</span>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const filtered = SALES.filter((sale) => {
    const book = saleBook(sale);
    const matchesQuery =
      !query.trim() ||
      sale.client.toLowerCase().includes(query.trim().toLowerCase()) ||
      book?.title.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === 'Todos los estados' || sale.status === statusFilter;
    const matchesDate = withinDateFilter(sale.dateISO, dateFilter);
    return matchesQuery && matchesStatus && matchesDate;
  });

  return (
    <AdminLayout title="Ventas">
      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            type="text"
            placeholder="Buscar por cliente o libro..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.search}
            aria-label="Buscar por cliente o libro"
          />
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as (typeof STATUS_OPTIONS)[number])}
            aria-label="Filtrar por estado"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            aria-label="Filtrar por fecha"
          >
            {DATE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className={styles.emptyState}>Ninguna venta coincide con estos filtros.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Libro</th>
                  <th>Importe</th>
                  <th>Pago</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sale) => {
                  const book = saleBook(sale);
                  return (
                    <tr key={sale.id} className={styles.row} onClick={() => setSelectedId(sale.id)}>
                      <td>{formatSaleDate(sale.dateISO)}</td>
                      <td className={styles.clientCell}>{sale.client}</td>
                      <td>{book?.title ?? '—'}</td>
                      <td>{book ? formatPrice(book.priceMinorUnits, book.currency) : '—'}</td>
                      <td className={styles.paymentCell}>Mercado Pago</td>
                      <td>
                        <StatusBadge tone={toneForStatus(sale.status)}>{sale.status}</StatusBadge>
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
