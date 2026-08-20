import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { formatPrice } from '../../../shared/utils/money';
import { apiRequest } from '../../../shared/api/client';
import { ADMIN_CUSTOMERS_URL } from '../../../shared/config/api';
import type { AdminCustomer, AdminCustomersPage } from '../../backoffice/types';
import { formatAdminDate } from '../../backoffice/presentation';
import styles from './ClientesPage.module.css';

const PAGE_SIZE = 20;

function initialsOf(name: string): string {
  return name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();
}

type CustomersState = { status: 'loading' } | { status: 'ready'; page: AdminCustomersPage } | { status: 'error' };

export function ClientesPage() {
  useDocumentTitle('Clientes · Admin · Nuestra Medicina Personal');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<AdminCustomer | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CustomersState>({ status: 'loading' });
  const retry = useCallback(() => { setState({ status: 'loading' }); setAttempt((value) => value + 1); }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (query) params.set('query', query);
    apiRequest<AdminCustomersPage>(`${ADMIN_CUSTOMERS_URL}?${params}`, { signal: controller.signal })
      .then((page) => setState({ status: 'ready', page }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [attempt, offset, query]);

  const applySearch = (event: FormEvent) => { event.preventDefault(); setState({ status: 'loading' }); setOffset(0); setSelected(null); setQuery(queryInput.trim()); setAttempt((value) => value + 1); };
  const page = state.status === 'ready' ? state.page : null;

  return <AdminLayout title="Clientes"><div className={styles.layout}>
    <div className={styles.panel}>
      <form className={styles.toolbar} onSubmit={applySearch}><input type="search" placeholder="Buscar por nombre o correo..." value={queryInput} onChange={(event) => setQueryInput(event.target.value)} className={styles.search} aria-label="Buscar clientes" /><Button variant="secondary" type="submit">Buscar</Button></form>
      {state.status === 'loading' ? <p className={styles.emptyState} role="status">Cargando clientes…</p> : state.status === 'error' ? (
        <div className={styles.emptyState} role="alert"><p>No pudimos cargar los clientes.</p><Button variant="secondary" onClick={retry}>Reintentar</Button></div>
      ) : page && page.items.length === 0 ? <p className={styles.emptyState}>Ningún cliente coincide con “{query}”.</p> : page && <>
        <div className={styles.tableScroll}><table className={styles.table}>
          <thead><tr><th>Nombre</th><th>Correo</th><th>Libros comprados</th><th>Última compra</th></tr></thead>
          <tbody>{page.items.map((customer) => <tr key={customer.id} onClick={() => setSelected(customer)} className={[styles.row, customer.id === selected?.id ? styles.rowSelected : ''].join(' ')}><td className={styles.nameCell}>{customer.displayName}</td><td className={styles.emailCell}>{customer.email}</td><td>{customer.booksPurchasedCount}</td><td className={styles.emailCell}>{formatAdminDate(customer.lastPurchaseAt)}</td></tr>)}</tbody>
        </table></div>
        <div className={styles.pagination}><span>{page.total === 0 ? 0 : page.offset + 1}–{Math.min(page.offset + page.limit, page.total)} de {page.total}</span><div className={styles.paginationActions}><Button variant="secondary" disabled={page.offset === 0} onClick={() => { setState({ status: 'loading' }); setSelected(null); setOffset(Math.max(0, page.offset - page.limit)); }}>Anterior</Button><Button variant="secondary" disabled={page.offset + page.limit >= page.total} onClick={() => { setState({ status: 'loading' }); setSelected(null); setOffset(page.offset + page.limit); }}>Siguiente</Button></div></div>
      </>}
    </div>
    {selected && <CustomerDetail customer={selected} />}
  </div></AdminLayout>;
}

function CustomerDetail({ customer }: { customer: AdminCustomer }) {
  return <aside className={styles.detail}>
    {customer.pictureUrl ? <img className={styles.avatarImage} src={customer.pictureUrl} alt="" /> : <span className={styles.avatar}>{initialsOf(customer.displayName)}</span>}
    <h2 className={styles.detailName}>{customer.displayName}</h2><p className={styles.detailEmail}>{customer.email}</p>
    <dl className={styles.summary}><div><dt>Compras pagadas</dt><dd>{customer.paidOrdersCount}</dd></div><div><dt>Total gastado</dt><dd>{formatPrice(customer.totalSpentMinorUnits, customer.currency)}</dd></div><div><dt>Último acceso</dt><dd>{formatAdminDate(customer.lastLoginAt)}</dd></div></dl>
    <p className={styles.detailLabel}>Libros comprados</p><div className={styles.bookList}>{customer.purchasedBooks.length === 0 ? <p className={styles.bookItem}>Todavía no compró libros.</p> : customer.purchasedBooks.map((book) => <p key={book.id} className={styles.bookItem}>• {book.title}<span className={styles.purchaseDate}>{formatAdminDate(book.purchasedAt)}</span></p>)}</div>
  </aside>;
}
