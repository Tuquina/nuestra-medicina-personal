import { Link } from 'react-router-dom';
import { formatPrice } from '../../../shared/utils/money';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { toneForStatus } from '../../../shared/utils/statusTone';
import type { AdminSale } from '../../backoffice/types';
import { formatAdminDate, SALE_STATUS_LABELS } from '../../backoffice/presentation';
import styles from './DashboardPage.module.css';

interface RecentSalesTableProps {
  title: string;
  sales: AdminSale[];
}

export function RecentSalesTable({ title, sales }: RecentSalesTableProps) {
  return (
    <div className={[styles.panel, styles.tableCard].join(' ')}>
      <div className={styles.tableHeader}>
        <h2 className={[styles.panelTitle, styles.tableTitle].join(' ')}>
          {title}
        </h2>
        <Link to="/admin/ventas" className={styles.tableLink}>
          Ver todas →
        </Link>
      </div>

      {sales.length === 0 ? (
        <p className={styles.emptyRow}>Todavía no hay ventas para mostrar en este período.</p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Libro</th>
                <th>Importe</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const statusLabel = SALE_STATUS_LABELS[sale.displayStatus];
                return (
                  <tr key={sale.id}>
                    <td>{formatAdminDate(sale.createdAt)}</td>
                    <td>{sale.customerName}</td>
                    <td>{sale.bookTitle}</td>
                    <td>{formatPrice(sale.amountMinorUnits, sale.currency)}</td>
                    <td>
                      <StatusBadge tone={toneForStatus(statusLabel)}>{statusLabel}</StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
