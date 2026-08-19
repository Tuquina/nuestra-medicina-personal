import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { Dialog } from '../../../shared/components/Dialog/Dialog';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { Switch } from '../../../shared/components/Switch/Switch';
import { FormField } from '../../../shared/components/FormField/FormField';
import { toneForStatus } from '../../../shared/utils/statusTone';
import { formatPrice } from '../../../shared/utils/money';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { BOOKS } from '../../../public-store/data/books';
import { ADMIN_NOW } from '../../adminNow';
import {
  computeStatus,
  createCoupon,
  deleteCoupon,
  getAllCoupons,
  subscribeToCoupons,
  updateCoupon,
  type Coupon,
  type CouponComputedStatus,
  type CouponKind,
  type NewCoupon,
} from '../../data/couponsStore';
import f from '../../../shared/components/FormField/FormField.module.css';
import styles from './CuponesPage.module.css';

const STATUS_OPTIONS: (CouponComputedStatus | 'Todos los estados')[] = [
  'Todos los estados',
  'Activo',
  'Programado',
  'Vencido',
  'Desactivado',
];

function valueLabel(coupon: Coupon): string {
  return coupon.kind === 'percentage' ? `${coupon.value}%` : formatPrice(coupon.value);
}

function appliesToLabel(coupon: Coupon): string {
  if (coupon.appliesTo === 'all') return 'Todos los libros';
  if (coupon.appliesTo.length === 0) return '—';
  if (coupon.appliesTo.length === 1) {
    return BOOKS.find((book) => book.slug === coupon.appliesTo[0])?.title ?? coupon.appliesTo[0];
  }
  return `${coupon.appliesTo.length} libros`;
}

function blankForm(): NewCoupon {
  return {
    code: '',
    kind: 'percentage',
    value: 10,
    startDateISO: ADMIN_NOW.toISOString().slice(0, 10),
    endDateISO: ADMIN_NOW.toISOString().slice(0, 10),
    usageLimit: null,
    appliesTo: 'all',
    active: true,
  };
}

/**
 * `/admin/cupones` — one of architecture.md §6's future extensions, now
 * built out with its own localStorage-backed store (`couponsStore.ts`),
 * shaped for a real `/api/v1/admin/coupons` endpoint later.
 */
export function CuponesPage() {
  useDocumentTitle('Cupones · Admin · Nuestra Medicina Personal');

  const [coupons, setCoupons] = useState<Coupon[]>(() => getAllCoupons());
  useEffect(() => subscribeToCoupons(() => setCoupons(getAllCoupons())), []);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>('Todos los estados');
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const filtered = coupons.filter((coupon) => {
    const matchesQuery = !query.trim() || coupon.code.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === 'Todos los estados' || computeStatus(coupon) === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <AdminLayout
      title="Cupones"
      headerActions={
        <Button variant="primary" onClick={() => setCreating(true)}>
          Nuevo cupón
        </Button>
      }
    >
      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <input
            type="text"
            placeholder="Buscar por código..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles.search}
            aria-label="Buscar por código"
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
        </div>

        {filtered.length === 0 ? (
          <p className={styles.emptyState}>Ningún cupón coincide con estos filtros.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Valor</th>
                <th>Vigencia</th>
                <th>Usos</th>
                <th>Aplica a</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((coupon) => (
                <tr key={coupon.id} className={styles.row} onClick={() => setEditing(coupon)}>
                  <td className={styles.codeCell}>{coupon.code}</td>
                  <td>{valueLabel(coupon)}</td>
                  <td className={styles.mutedCell}>
                    {coupon.startDateISO} – {coupon.endDateISO}
                  </td>
                  <td className={styles.mutedCell}>
                    {coupon.usageCount}
                    {coupon.usageLimit !== null ? ` / ${coupon.usageLimit}` : ''}
                  </td>
                  <td className={styles.mutedCell}>{appliesToLabel(coupon)}</td>
                  <td>
                    <StatusBadge tone={toneForStatus(computeStatus(coupon))}>{computeStatus(coupon)}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(creating || editing) && (
        <CouponFormDialog
          coupon={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onRequestDelete={editing ? () => setPendingDeleteId(editing.id) : undefined}
        />
      )}

      <Dialog
        open={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        title="¿Eliminar este cupón?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (pendingDeleteId) deleteCoupon(pendingDeleteId);
                setPendingDeleteId(null);
                setEditing(null);
              }}
            >
              Eliminar
            </Button>
          </>
        }
      >
        Esta acción no se puede deshacer.
      </Dialog>
    </AdminLayout>
  );
}

function CouponFormDialog({
  coupon,
  onClose,
  onRequestDelete,
}: {
  coupon: Coupon | null;
  onClose: () => void;
  onRequestDelete?: () => void;
}) {
  const [form, setForm] = useState<NewCoupon>(() => (coupon ? { ...coupon } : blankForm()));

  const update = <K extends keyof NewCoupon>(key: K, value: NewCoupon[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleBook = (slug: string) => {
    const current = form.appliesTo === 'all' ? [] : form.appliesTo;
    const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
    update('appliesTo', next);
  };

  const save = () => {
    if (!form.code.trim()) return;
    if (coupon) {
      updateCoupon(coupon.id, form);
    } else {
      createCoupon(form);
    }
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={coupon ? `Editar ${coupon.code}` : 'Nuevo cupón'}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save}>
            {coupon ? 'Guardar cambios' : 'Crear cupón'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <FormField label="Código" htmlFor="couponCode">
          <input
            id="couponCode"
            type="text"
            className={[f.control, f.mono].join(' ')}
            value={form.code}
            onChange={(e) => update('code', e.target.value.toUpperCase())}
          />
        </FormField>

        <div className={styles.formRow2}>
          <FormField label="Tipo" htmlFor="couponKind">
            <select
              id="couponKind"
              className={f.control}
              value={form.kind}
              onChange={(e) => update('kind', e.target.value as CouponKind)}
            >
              <option value="percentage">Porcentaje</option>
              <option value="fixed">Monto fijo</option>
            </select>
          </FormField>
          <FormField label={form.kind === 'percentage' ? 'Valor (%)' : 'Valor ($)'} htmlFor="couponValue">
            <input
              id="couponValue"
              type="number"
              min={0}
              className={f.control}
              value={form.kind === 'percentage' ? form.value : form.value / 100}
              onChange={(e) =>
                update('value', form.kind === 'percentage' ? Number(e.target.value) : Number(e.target.value) * 100)
              }
            />
          </FormField>
        </div>

        <div className={styles.formRow2}>
          <FormField label="Desde" htmlFor="couponStart">
            <input
              id="couponStart"
              type="date"
              className={f.control}
              value={form.startDateISO}
              onChange={(e) => update('startDateISO', e.target.value)}
            />
          </FormField>
          <FormField label="Hasta" htmlFor="couponEnd">
            <input
              id="couponEnd"
              type="date"
              className={f.control}
              value={form.endDateISO}
              onChange={(e) => update('endDateISO', e.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Límite de usos (vacío = sin límite)" htmlFor="couponLimit">
          <input
            id="couponLimit"
            type="number"
            min={0}
            className={f.control}
            value={form.usageLimit ?? ''}
            onChange={(e) => update('usageLimit', e.target.value === '' ? null : Number(e.target.value))}
          />
        </FormField>

        <FormField label="Aplica a" htmlFor="couponAppliesAll">
          <select
            id="couponAppliesAll"
            className={f.control}
            value={form.appliesTo === 'all' ? 'all' : 'specific'}
            onChange={(e) => update('appliesTo', e.target.value === 'all' ? 'all' : [])}
          >
            <option value="all">Todos los libros</option>
            <option value="specific">Libros específicos</option>
          </select>
        </FormField>

        {form.appliesTo !== 'all' && (
          <div className={styles.appliesToList}>
            {BOOKS.map((book) => (
              <label key={book.slug} className={styles.appliesToRow}>
                <input
                  type="checkbox"
                  checked={form.appliesTo !== 'all' && form.appliesTo.includes(book.slug)}
                  onChange={() => toggleBook(book.slug)}
                />
                {book.title}
              </label>
            ))}
          </div>
        )}

        <div className={styles.activeRow}>
          <span className={styles.activeLabel}>Cupón activo</span>
          <Switch checked={form.active} onChange={(active) => update('active', active)} label="Cupón activo" />
        </div>

        {onRequestDelete && (
          <div className={styles.deleteRow}>
            <button type="button" className={styles.deleteLink} onClick={onRequestDelete}>
              Eliminar cupón
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
