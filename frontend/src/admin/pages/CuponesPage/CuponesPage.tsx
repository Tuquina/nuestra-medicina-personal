import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { Dialog } from '../../../shared/components/Dialog/Dialog';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { Switch } from '../../../shared/components/Switch/Switch';
import { FormField } from '../../../shared/components/FormField/FormField';
import { toneForStatus } from '../../../shared/utils/statusTone';
import { formatPrice } from '../../../shared/utils/money';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { apiRequest } from '../../../shared/api/client';
import { ADMIN_BOOKS_URL, ADMIN_COUPONS_URL, adminCouponUrl } from '../../../shared/config/api';
import type { AdminBook, AdminBookList } from '../../books/types';
import f from '../../../shared/components/FormField/FormField.module.css';
import styles from './CuponesPage.module.css';

type CouponKind = 'PERCENTAGE' | 'FIXED';
type CouponStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'INACTIVE';
interface Coupon { id: string; code: string; kind: CouponKind; value: number; currency: string; startsAt: string; endsAt: string; usageLimit: number | null; usageCount: number; appliesToAll: boolean; bookIds: string[]; active: boolean; status: CouponStatus }
type CouponInput = Omit<Coupon, 'id' | 'usageCount' | 'status'>;
interface CouponList { items: Coupon[]; total: number }

const STATUS_LABEL: Record<CouponStatus, string> = { ACTIVE: 'Activo', SCHEDULED: 'Programado', EXPIRED: 'Vencido', INACTIVE: 'Desactivado' };
const STATUS_OPTIONS: Array<CouponStatus | 'ALL'> = ['ALL', 'ACTIVE', 'SCHEDULED', 'EXPIRED', 'INACTIVE'];

function blankForm(): CouponInput {
  const today = new Date().toISOString().slice(0, 10);
  return { code: '', kind: 'PERCENTAGE', value: 10, currency: 'ARS', startsAt: today, endsAt: today, usageLimit: null, appliesToAll: true, bookIds: [], active: true };
}

function valueLabel(coupon: Coupon): string {
  return coupon.kind === 'PERCENTAGE' ? `${coupon.value}%` : formatPrice(coupon.value, coupon.currency);
}

export function CuponesPage() {
  useDocumentTitle('Cupones · Admin · Nuestra Medicina Personal');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CouponStatus | 'ALL'>('ALL');
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [couponPage, bookPage] = await Promise.all([apiRequest<CouponList>(ADMIN_COUPONS_URL, { signal }), apiRequest<AdminBookList>(ADMIN_BOOKS_URL, { signal })]);
      setCoupons(couponPage.items); setBooks(bookPage.items); setStatus('ready');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setStatus('error');
    }
  }, []);

  // The state changes happen after the API promises settle.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const filtered = coupons.filter((coupon) => (!query.trim() || coupon.code.toLowerCase().includes(query.trim().toLowerCase())) && (statusFilter === 'ALL' || coupon.status === statusFilter));
  const scopeLabel = (coupon: Coupon) => coupon.appliesToAll ? 'Todos los libros' : coupon.bookIds.length === 1 ? books.find((book) => book.id === coupon.bookIds[0])?.title ?? '1 libro' : `${coupon.bookIds.length} libros`;
  const remove = async () => { if (!pendingDeleteId) return; await apiRequest<void>(adminCouponUrl(pendingDeleteId), { method: 'DELETE' }); setPendingDeleteId(null); setEditing(null); await load(); };

  return <AdminLayout title="Cupones" headerActions={<Button variant="primary" onClick={() => setCreating(true)}>Nuevo cupón</Button>}>
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <input type="text" placeholder="Buscar por código..." value={query} onChange={(event) => setQuery(event.target.value)} className={styles.search} aria-label="Buscar por código" />
        <select className={styles.select} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CouponStatus | 'ALL')} aria-label="Filtrar por estado">{STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option === 'ALL' ? 'Todos los estados' : STATUS_LABEL[option]}</option>)}</select>
      </div>
      {status === 'loading' ? <p className={styles.emptyState}>Cargando cupones…</p> : status === 'error' ? <div className={styles.emptyState}><p>No pudimos cargar los cupones.</p><Button variant="secondary" onClick={() => { setStatus('loading'); void load(); }}>Reintentar</Button></div> : filtered.length === 0 ? <p className={styles.emptyState}>Ningún cupón coincide con estos filtros.</p> :
        <div className={styles.tableScroll}><table className={styles.table}><thead><tr><th>Código</th><th>Valor</th><th>Vigencia</th><th>Usos</th><th>Aplica a</th><th>Estado</th></tr></thead><tbody>{filtered.map((coupon) => <tr key={coupon.id} className={styles.row} onClick={() => setEditing(coupon)}><td className={styles.codeCell}>{coupon.code}</td><td>{valueLabel(coupon)}</td><td className={styles.mutedCell}>{coupon.startsAt} – {coupon.endsAt}</td><td className={styles.mutedCell}>{coupon.usageCount}{coupon.usageLimit !== null ? ` / ${coupon.usageLimit}` : ''}</td><td className={styles.mutedCell}>{scopeLabel(coupon)}</td><td><StatusBadge tone={toneForStatus(STATUS_LABEL[coupon.status])}>{STATUS_LABEL[coupon.status]}</StatusBadge></td></tr>)}</tbody></table></div>}
    </div>
    {(creating || editing) && <CouponFormDialog coupon={editing} books={books} onSaved={async () => { setCreating(false); setEditing(null); await load(); }} onClose={() => { setCreating(false); setEditing(null); }} onRequestDelete={editing ? () => setPendingDeleteId(editing.id) : undefined} />}
    <Dialog open={pendingDeleteId !== null} onClose={() => setPendingDeleteId(null)} title="¿Eliminar este cupón?" actions={<><Button variant="secondary" onClick={() => setPendingDeleteId(null)}>Cancelar</Button><Button variant="danger" onClick={() => void remove()}>Eliminar</Button></>}>Esta acción no se puede deshacer.</Dialog>
  </AdminLayout>;
}

function CouponFormDialog({ coupon, books, onSaved, onClose, onRequestDelete }: { coupon: Coupon | null; books: AdminBook[]; onSaved: () => Promise<void>; onClose: () => void; onRequestDelete?: () => void }) {
  const [form, setForm] = useState<CouponInput>(() => coupon ? { code: coupon.code, kind: coupon.kind, value: coupon.value, currency: coupon.currency, startsAt: coupon.startsAt, endsAt: coupon.endsAt, usageLimit: coupon.usageLimit, appliesToAll: coupon.appliesToAll, bookIds: coupon.bookIds, active: coupon.active } : blankForm());
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const update = <K extends keyof CouponInput>(key: K, value: CouponInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const toggleBook = (id: string) => update('bookIds', form.bookIds.includes(id) ? form.bookIds.filter((value) => value !== id) : [...form.bookIds, id]);
  const save = async () => { setSaving(true); setFailed(false); try { await apiRequest<Coupon>(coupon ? adminCouponUrl(coupon.id) : ADMIN_COUPONS_URL, { method: coupon ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); await onSaved(); } catch { setFailed(true); } finally { setSaving(false); } };

  return <Dialog open onClose={onClose} title={coupon ? `Editar ${coupon.code}` : 'Nuevo cupón'} actions={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={saving} onClick={() => void save()}>{saving ? 'Guardando…' : coupon ? 'Guardar cambios' : 'Crear cupón'}</Button></>}>
    <div className={styles.form}>{failed && <p role="alert">No pudimos guardar el cupón. Revisá los datos e intentá nuevamente.</p>}
      <FormField label="Código" htmlFor="couponCode"><input id="couponCode" className={[f.control, f.mono].join(' ')} value={form.code} onChange={(event) => update('code', event.target.value.toUpperCase())} /></FormField>
      <div className={styles.formRow2}><FormField label="Tipo" htmlFor="couponKind"><select id="couponKind" className={f.control} value={form.kind} onChange={(event) => update('kind', event.target.value as CouponKind)}><option value="PERCENTAGE">Porcentaje</option><option value="FIXED">Monto fijo</option></select></FormField><FormField label={form.kind === 'PERCENTAGE' ? 'Valor (%)' : 'Valor ($)'} htmlFor="couponValue"><input id="couponValue" type="number" min={1} className={f.control} value={form.kind === 'PERCENTAGE' ? form.value : form.value / 100} onChange={(event) => update('value', form.kind === 'PERCENTAGE' ? Number(event.target.value) : Math.round(Number(event.target.value) * 100))} /></FormField></div>
      <div className={styles.formRow2}><FormField label="Desde" htmlFor="couponStart"><input id="couponStart" type="date" className={f.control} value={form.startsAt} onChange={(event) => update('startsAt', event.target.value)} /></FormField><FormField label="Hasta" htmlFor="couponEnd"><input id="couponEnd" type="date" className={f.control} value={form.endsAt} onChange={(event) => update('endsAt', event.target.value)} /></FormField></div>
      <FormField label="Límite de usos (vacío = sin límite)" htmlFor="couponLimit"><input id="couponLimit" type="number" min={1} className={f.control} value={form.usageLimit ?? ''} onChange={(event) => update('usageLimit', event.target.value === '' ? null : Number(event.target.value))} /></FormField>
      <FormField label="Aplica a" htmlFor="couponScope"><select id="couponScope" className={f.control} value={form.appliesToAll ? 'all' : 'specific'} onChange={(event) => update('appliesToAll', event.target.value === 'all')}><option value="all">Todos los libros</option><option value="specific">Libros específicos</option></select></FormField>
      {!form.appliesToAll && <div className={styles.appliesToList}>{books.map((book) => <label key={book.id} className={styles.appliesToRow}><input type="checkbox" checked={form.bookIds.includes(book.id)} onChange={() => toggleBook(book.id)} />{book.title}</label>)}</div>}
      <div className={styles.activeRow}><span className={styles.activeLabel}>Cupón activo</span><Switch checked={form.active} onChange={(active) => update('active', active)} label="Cupón activo" /></div>
      {onRequestDelete && <div className={styles.deleteRow}><button type="button" className={styles.deleteLink} onClick={onRequestDelete}>Eliminar cupón</button></div>}
    </div>
  </Dialog>;
}
