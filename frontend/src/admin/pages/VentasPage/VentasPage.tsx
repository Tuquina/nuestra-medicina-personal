import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { toneForStatus } from '../../../shared/utils/statusTone';
import { formatPrice } from '../../../shared/utils/money';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { apiRequest } from '../../../shared/api/client';
import { ADMIN_SALES_URL } from '../../../shared/config/api';
import type { AdminSale, AdminSalesPage, ReportingRange, SaleDisplayStatus } from '../../backoffice/types';
import { formatAdminDate, SALE_STATUS_LABELS } from '../../backoffice/presentation';
import styles from './VentasPage.module.css';

const PAGE_SIZE = 20;
const STATUS_OPTIONS: Array<{ value: SaleDisplayStatus | ''; label: string }> = [
  { value: '', label: 'Todos los estados' },
  ...Object.entries(SALE_STATUS_LABELS).map(([value, label]) => ({ value: value as SaleDisplayStatus, label })),
];
const DATE_OPTIONS: Array<{ value: ReportingRange; label: string }> = [
  { value: 'all', label: 'Todas las fechas' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: 'year', label: 'Este año' },
];

type SalesState = { status: 'loading' } | { status: 'ready'; page: AdminSalesPage } | { status: 'error' };

export function VentasPage() {
  useDocumentTitle('Ventas · Admin · Nuestra Medicina Personal');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SaleDisplayStatus | ''>('');
  const [range, setRange] = useState<ReportingRange>('all');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<AdminSale | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SalesState>({ status: 'loading' });

  const retry = useCallback(() => { setState({ status: 'loading' }); setAttempt((value) => value + 1); }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ range, limit: String(PAGE_SIZE), offset: String(offset) });
    if (query) params.set('query', query);
    if (statusFilter) params.set('status', statusFilter);
    apiRequest<AdminSalesPage>(`${ADMIN_SALES_URL}?${params}`, { signal: controller.signal })
      .then((page) => setState({ status: 'ready', page }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [attempt, offset, query, range, statusFilter]);

  const applySearch = (event: FormEvent) => { event.preventDefault(); setState({ status: 'loading' }); setOffset(0); setQuery(queryInput.trim()); setAttempt((value) => value + 1); };
  if (selected) return <SaleDetail sale={selected} onBack={() => setSelected(null)} />;

  const page = state.status === 'ready' ? state.page : null;
  return (
    <AdminLayout title="Ventas">
      <div className={styles.panel}>
        <form className={styles.toolbar} onSubmit={applySearch}>
          <input type="search" placeholder="Buscar por cliente, correo o libro..." value={queryInput} onChange={(event) => setQueryInput(event.target.value)} className={styles.search} aria-label="Buscar por cliente, correo o libro" />
          <Button variant="secondary" type="submit">Buscar</Button>
          <select className={styles.select} value={statusFilter} onChange={(event) => { setState({ status: 'loading' }); setOffset(0); setStatusFilter(event.target.value as SaleDisplayStatus | ''); }} aria-label="Filtrar por estado">
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className={styles.select} value={range} onChange={(event) => { setState({ status: 'loading' }); setOffset(0); setRange(event.target.value as ReportingRange); }} aria-label="Filtrar por fecha">
            {DATE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </form>
        {state.status === 'loading' ? <p className={styles.emptyState} role="status">Cargando ventas…</p> : state.status === 'error' ? (
          <div className={styles.emptyState} role="alert"><p>No pudimos cargar las ventas.</p><Button variant="secondary" onClick={retry}>Reintentar</Button></div>
        ) : page && page.items.length === 0 ? <p className={styles.emptyState}>Ninguna venta coincide con estos filtros.</p> : page && (
          <>
            <div className={styles.tableScroll}><table className={styles.table}>
              <thead><tr><th>Fecha</th><th>Cliente</th><th>Libro</th><th>Importe</th><th>Pago</th><th>Estado</th></tr></thead>
              <tbody>{page.items.map((sale) => { const label = SALE_STATUS_LABELS[sale.displayStatus]; return (
                <tr key={sale.id} className={styles.row} onClick={() => setSelected(sale)}>
                  <td>{formatAdminDate(sale.createdAt)}</td><td className={styles.clientCell}>{sale.customerName}</td><td>{sale.bookTitle}</td><td>{formatPrice(sale.amountMinorUnits, sale.currency)}</td><td className={styles.paymentCell}>{sale.paymentProvider ?? '—'}</td><td><StatusBadge tone={toneForStatus(label)}>{label}</StatusBadge></td>
                </tr>); })}</tbody>
            </table></div>
            <Pagination offset={page.offset} limit={page.limit} total={page.total} onChange={(value) => { setState({ status: 'loading' }); setOffset(value); }} />
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function SaleDetail({ sale, onBack }: { sale: AdminSale; onBack: () => void }) {
  const label = SALE_STATUS_LABELS[sale.displayStatus];
  return <AdminLayout title="Ventas"><button type="button" className={styles.backButton} onClick={onBack}>← Volver a ventas</button><div className={styles.detailCard}>
    <div className={styles.detailHeader}><h2 className={styles.detailHeading}>Venta #{sale.id}</h2><StatusBadge tone={toneForStatus(label)}>{label}</StatusBadge></div>
    <div className={styles.detailRows}>
      <Detail label="Fecha" value={formatAdminDate(sale.createdAt)} /><Detail label="Fecha de pago" value={formatAdminDate(sale.paidAt)} /><Detail label="Cliente" value={sale.customerName} /><Detail label="Correo" value={sale.customerEmail} /><Detail label="Libro" value={sale.bookTitle} /><Detail label="Precio histórico" value={formatPrice(sale.amountMinorUnits, sale.currency)} />
      <Detail label="Estado de la orden" value={sale.orderStatus} divider /><Detail label="Estado del pago" value={sale.paymentStatus ?? '—'} /><Detail label="Proveedor" value={sale.paymentProvider ?? '—'} /><Detail label="ID del proveedor" value={sale.providerPaymentId ?? '—'} mono />
    </div>
  </div></AdminLayout>;
}

function Detail({ label, value, divider = false, mono = false }: { label: string; value: string; divider?: boolean; mono?: boolean }) {
  return <div className={[styles.detailRow, divider ? styles.detailRowDivider : ''].join(' ')}><span className={styles.detailLabel}>{label}</span><span className={[styles.detailValue, mono ? styles.mono : ''].join(' ')}>{value}</span></div>;
}

function Pagination({ offset, limit, total, onChange }: { offset: number; limit: number; total: number; onChange: (offset: number) => void }) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  return <div className={styles.pagination}><span>{from}–{to} de {total}</span><div className={styles.paginationActions}><Button variant="secondary" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>Anterior</Button><Button variant="secondary" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>Siguiente</Button></div></div>;
}
