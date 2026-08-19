import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { Tabs, type TabItem } from '../../../shared/components/Tabs/Tabs';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { BOOKS } from '../../../public-store/data/books';
import { NotFoundPage } from '../../../public-store/pages/NotFoundPage/NotFoundPage';
import { InformacionTab } from './InformacionTab';
import { ArchivoPortadaTab } from './ArchivoPortadaTab';
import { ManuscritoTab } from './ManuscritoTab';
import { PaginaVentaTab } from './PaginaVentaTab';
import { SeoTab } from './SeoTab';
import type { LibroFormState } from './libroFormTypes';
import styles from './LibroFormPage.module.css';

const TABS: TabItem[] = [
  { id: 'info', label: 'Información' },
  { id: 'files', label: 'Archivo y portada' },
  { id: 'manuscript', label: 'Manuscrito' },
  { id: 'page', label: 'Página de venta' },
  { id: 'seo', label: 'SEO' },
];

function minorUnitsToDisplay(minorUnits: number): string {
  if (!minorUnits) return '';
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(minorUnits / 100);
}

function parseDisplayToMinorUnits(display: string): number {
  const digits = display.replace(/[^\d]/g, '');
  return digits ? Number(digits) * 100 : 0;
}

const BLANK_FORM: LibroFormState = {
  title: '',
  subtitle: '',
  authorName: '',
  slug: '',
  shortDescription: '',
  priceDisplay: '',
  currency: 'ARS',
  status: 'DRAFT',
  isbn: '',
  publicationDateLabel: '',
  format: 'PDF, EPUB',
  seoTitle: '',
  seoDescription: '',
  seoIndexable: true,
};

/**
 * `/admin/libros/nuevo` and `/admin/libros/:slug/editar` — both render
 * this same form, matching Admin Libro Nuevo.dc.html (the mockup's own
 * "Libros" list links every "Editar" action at the identical file).
 */
export function LibroFormPage() {
  const { slug } = useParams<{ slug: string }>();
  const isEditing = Boolean(slug);
  const existingBook = slug ? BOOKS.find((book) => book.slug === slug) : undefined;

  if (isEditing && !existingBook) {
    return <NotFoundPage />;
  }

  return <LibroFormContent existingBook={existingBook} />;
}

function LibroFormContent({ existingBook }: { existingBook: (typeof BOOKS)[number] | undefined }) {
  const isEditing = Boolean(existingBook);

  useDocumentTitle(
    `${existingBook ? existingBook.title : 'Nuevo libro'} · Admin · Nuestra Medicina Personal`,
  );

  const [form, setForm] = useState<LibroFormState>(() =>
    existingBook
      ? {
          title: existingBook.title,
          subtitle: existingBook.subtitle,
          authorName: existingBook.authorName,
          slug: existingBook.slug,
          shortDescription: existingBook.shortDescription,
          priceDisplay: minorUnitsToDisplay(existingBook.priceMinorUnits),
          currency: existingBook.currency,
          status: existingBook.status,
          isbn: existingBook.isbn,
          publicationDateLabel: existingBook.publicationDateLabel,
          format: existingBook.format,
          seoTitle: `${existingBook.title} — Nuestra Medicina Personal`,
          seoDescription: existingBook.shortDescription,
          seoIndexable: true,
        }
      : BLANK_FORM,
  );
  const [activeTab, setActiveTab] = useState('info');
  const [saveStatus, setSaveStatus] = useState('Guardado');

  const updateField = <K extends keyof LibroFormState>(key: K, value: LibroFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async (nextStatus: LibroFormState['status']) => {
    setForm((prev) => ({ ...prev, status: nextStatus }));
    setSaveStatus(nextStatus === 'PUBLISHED' ? 'Publicando…' : 'Guardando…');
    try {
      await fetch(`/api/v1/admin/books/${form.slug || 'nuevo'}`, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          priceMinorUnits: parseDisplayToMinorUnits(form.priceDisplay),
          status: nextStatus,
        }),
      });
    } catch {
      // No backend yet.
    } finally {
      setSaveStatus('Guardado');
    }
  };

  return (
    <AdminLayout
      title={existingBook ? existingBook.title : 'Nuevo libro'}
      hideAvatar
      titleSlot={
        <div className={styles.headerLeft}>
          <Link to="/admin/libros" className={styles.backLink}>
            ← Libros
          </Link>
          <h1 className={styles.headerTitle}>{existingBook ? existingBook.title : 'Nuevo libro'}</h1>
        </div>
      }
      headerActions={
        <div className={styles.headerActions}>
          <span className={styles.saveStatus}>{saveStatus}</span>
          <Button variant="secondary" onClick={() => save('DRAFT')}>
            Guardar borrador
          </Button>
          <Button variant="primary" onClick={() => save('PUBLISHED')}>
            Publicar
          </Button>
        </div>
      }
    >
      <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

      <div className={activeTab === 'manuscript' ? styles.contentWide : styles.content}>
        {activeTab === 'info' && <InformacionTab form={form} onChange={updateField} />}
        {activeTab === 'files' && (
          <ArchivoPortadaTab
            variant={existingBook?.variant ?? 'gold'}
            coverCaption={existingBook?.coverCaption ?? 'Portada del libro'}
            ebookFileName={existingBook ? `${existingBook.slug}.epub` : 'sin-archivo.epub'}
            ebookFileMeta={existingBook ? `EPUB · 2,4 MB` : 'Ningún archivo cargado'}
          />
        )}
        {activeTab === 'manuscript' && <ManuscritoTab bookTitle={form.title || 'Nuevo libro'} />}
        {activeTab === 'page' && <PaginaVentaTab slug={form.slug} bookTitle={form.title || 'Nuevo libro'} />}
        {activeTab === 'seo' && <SeoTab form={form} onChange={updateField} />}
      </div>
    </AdminLayout>
  );
}
