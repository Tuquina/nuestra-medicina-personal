import { useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { BOOKS } from '../../../public-store/data/books';
import { CUSTOMERS } from '../../data/customers';
import { formatSaleDate } from '../DashboardPage/dashboardData';
import styles from './ClientesPage.module.css';

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** `/admin/clientes` — customer directory with a side detail panel, built from Admin Clientes.dc.html. */
export function ClientesPage() {
  useDocumentTitle('Clientes · Admin · Nuestra Medicina Personal');

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = CUSTOMERS.filter((customer) => {
    const q = query.trim().toLowerCase();
    return !q || customer.name.toLowerCase().includes(q) || customer.email.toLowerCase().includes(q);
  });

  const selected = CUSTOMERS.find((customer) => customer.id === selectedId);

  return (
    <AdminLayout title="Clientes">
      <div className={styles.layout}>
        <div className={styles.panel}>
          <div className={styles.toolbar}>
            <input
              type="text"
              placeholder="Buscar clientes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={styles.search}
              aria-label="Buscar clientes"
            />
          </div>

          {filtered.length === 0 ? (
            <p className={styles.emptyState}>Ningún cliente coincide con "{query}".</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Libros comprados</th>
                  <th>Última compra</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => setSelectedId(customer.id)}
                    className={[styles.row, customer.id === selectedId ? styles.rowSelected : ''].join(' ')}
                  >
                    <td className={styles.nameCell}>{customer.name}</td>
                    <td className={styles.emailCell}>{customer.email}</td>
                    <td>{customer.bookSlugs.length}</td>
                    <td className={styles.emailCell}>{formatSaleDate(customer.lastPurchaseISO)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected && (
          <div className={styles.detail}>
            <span className={styles.avatar}>{initialsOf(selected.name)}</span>
            <h2 className={styles.detailName}>{selected.name}</h2>
            <p className={styles.detailEmail}>{selected.email}</p>
            <p className={styles.detailLabel}>Libros comprados</p>
            <div className={styles.bookList}>
              {selected.bookSlugs.map((slug) => {
                const book = BOOKS.find((entry) => entry.slug === slug);
                return (
                  <p key={slug} className={styles.bookItem}>
                    • {book?.title ?? slug}
                  </p>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
