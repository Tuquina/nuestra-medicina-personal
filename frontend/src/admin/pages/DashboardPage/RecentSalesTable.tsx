import { Link } from 'react-router-dom';
import { formatPrice } from '../../../shared/utils/money';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { toneForStatus } from '../../../shared/utils/statusTone';
import { saleBook, type Sale } from '../../data/sales';
import { formatSaleDate } from './dashboardData';
import styles from './DashboardPage.module.css';

interface RecentSalesTableProps {
  title: string;
  sales: Sale[];
}

export function RecentSalesTable({ title, sales }: RecentSalesTableProps) {
  return (
    <div className={[styles.panel, styles.tableCard].join(' ')}>
      <div className={styles.tableHeader}>
        <h2 className={styles.panelTitle} style={{ margin: 0 }}>
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
                const book = saleBook(sale);
                return (
                  <tr key={sale.id}>
                    <td>{formatSaleDate(sale.dateISO)}</td>
                    <td>{sale.client}</td>
                    <td>{book?.title ?? '—'}</td>
                    <td>{book ? formatPrice(book.priceMinorUnits, book.currency) : '—'}</td>
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
  );
}
