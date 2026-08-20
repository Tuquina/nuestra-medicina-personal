import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { Tabs, type TabItem } from '../../../shared/components/Tabs/Tabs';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { apiRequest, ApiError } from '../../../shared/api/client';
import { ADMIN_BOOKS_URL, adminBookUrl } from '../../../shared/config/api';
import type { AdminBook, AdminBookInput, EbookUploadResponse } from '../../books/types';
import type { MediaAsset } from '../../media/types';
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
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: minorUnits % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}

function parseDisplayToMinorUnits(display: string): number {
  const normalized = display.trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

const BLANK_FORM: LibroFormState = {
  title: '',
  subtitle: '',
  authorName: '',
  category: '',
  variant: 'blue',
  slug: '',
  shortDescription: '',
  priceDisplay: '',
  currency: 'ARS',
  status: 'DRAFT',
  isbn: '',
  publicationDate: '',
  publicationDateLabel: '',
  format: 'PDF · EPUB',
  fileSizeBytes: null,
  coverMediaId: null,
  coverCaption: '',
  seoTitle: '',
  seoDescription: '',
  seoIndexable: true,
};

function formFromBook(book: AdminBook): LibroFormState {
  return {
    title: book.title,
    subtitle: book.subtitle,
    authorName: book.authorName,
    category: book.category,
    variant: book.variant,
    slug: book.slug,
    shortDescription: book.shortDescription,
    priceDisplay: minorUnitsToDisplay(book.priceMinorUnits),
    currency: book.currency,
    status: book.status,
    isbn: book.isbn,
    publicationDate: book.publicationDate ?? '',
    publicationDateLabel: book.publicationDateLabel,
    format: book.format,
    fileSizeBytes: book.fileSizeBytes,
    coverMediaId: book.coverMediaId,
    coverCaption: book.coverCaption,
    seoTitle: book.seoTitle,
    seoDescription: book.seoDescription,
    seoIndexable: book.seoIndexable,
  };
}

function inputFromForm(form: LibroFormState, status: LibroFormState['status']): AdminBookInput {
  return {
    slug: form.slug,
    title: form.title,
    subtitle: form.subtitle,
    authorName: form.authorName,
    category: form.category,
    variant: form.variant,
    shortDescription: form.shortDescription,
    priceMinorUnits: parseDisplayToMinorUnits(form.priceDisplay),
    currency: form.currency,
    isbn: form.isbn,
    publicationDate: form.publicationDate || null,
    publicationDateLabel: form.publicationDateLabel,
    format: form.format,
    fileSizeBytes: form.fileSizeBytes,
    coverMediaId: form.coverMediaId,
    coverCaption: form.coverCaption,
    status,
    seoTitle: form.seoTitle,
    seoDescription: form.seoDescription,
    seoIndexable: form.seoIndexable,
  };
}

/** `/admin/libros/nuevo` and `/admin/libros/:slug/editar`. */
export function LibroFormPage() {
  const { slug } = useParams<{ slug: string }>();
  return slug ? <ExistingBookForm key={slug} slug={slug} /> : <LibroFormContent initialBook={null} />;
}

function ExistingBookForm({ slug }: { slug: string }) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; book: AdminBook }
    | { status: 'not-found' }
    | { status: 'error' }
  >({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<AdminBook>(adminBookUrl(slug), { signal: controller.signal })
      .then((book) => setState({ status: 'ready', book }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState(error instanceof ApiError && error.status === 404 ? { status: 'not-found' } : { status: 'error' });
      });
    return () => controller.abort();
  }, [attempt, slug]);

  if (state.status === 'ready') return <LibroFormContent initialBook={state.book} />;

  return (
    <AdminLayout title="Libro" hideAvatar>
      <div className={styles.resourceState} role={state.status === 'loading' ? 'status' : 'alert'}>
        <p>
          {state.status === 'loading'
            ? 'Cargando libro…'
            : state.status === 'not-found'
              ? 'El libro no existe.'
              : 'No pudimos cargar el libro.'}
        </p>
        {state.status === 'error' && (
          <Button
            variant="secondary"
            onClick={() => {
              setState({ status: 'loading' });
              setAttempt((value) => value + 1);
            }}
          >
            Reintentar
          </Button>
        )}
        {state.status === 'not-found' && <Button variant="secondary" to="/admin/libros">Volver a libros</Button>}
      </div>
    </AdminLayout>
  );
}

function LibroFormContent({ initialBook }: { initialBook: AdminBook | null }) {
  const navigate = useNavigate();
  const [savedBook, setSavedBook] = useState<AdminBook | null>(initialBook);
  const [form, setForm] = useState<LibroFormState>(() =>
    initialBook ? formFromBook(initialBook) : { ...BLANK_FORM },
  );
  const [activeTab, setActiveTab] = useState('info');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(initialBook ? 'Guardado' : 'Sin guardar');
  const [saveError, setSaveError] = useState<string | null>(null);

  useDocumentTitle(
    `${savedBook ? savedBook.title : 'Nuevo libro'} · Admin · Nuestra Medicina Personal`,
  );

  const updateField = <K extends keyof LibroFormState>(key: K, value: LibroFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSaveStatus('Cambios sin guardar');
  };

  const save = async (nextStatus: LibroFormState['status']) => {
    setSaving(true);
    setSaveError(null);
    setSaveStatus(nextStatus === 'PUBLISHED' ? 'Publicando…' : 'Guardando…');
    try {
      const saved = await apiRequest<AdminBook>(
        savedBook ? adminBookUrl(savedBook.id) : ADMIN_BOOKS_URL,
        {
          method: savedBook ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inputFromForm(form, nextStatus)),
        },
      );
      setSavedBook(saved);
      setForm(formFromBook(saved));
      setSaveStatus('Guardado');
      if (!savedBook || saved.slug !== savedBook.slug) {
        navigate(`/admin/libros/${saved.slug}/editar`, { replace: true });
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'BOOK_LANDING_NOT_PUBLISHED') {
        setSaveError(savedBook
          ? 'Publicá primero la página de venta y después publicá el libro.'
          : 'Guardá primero el libro como borrador para poder crear y publicar su página de venta.');
      } else if (error instanceof ApiError && error.status === 409) {
        setSaveError('Ya existe un libro con ese slug.');
      } else if (error instanceof ApiError && error.status === 422) {
        setSaveError('Revisá los campos obligatorios y el precio antes de guardar.');
      } else if (error instanceof ApiError && error.status === 429) {
        setSaveError('Alcanzaste el límite de operaciones. Esperá un minuto y reintentá.');
      } else {
        setSaveError('No pudimos guardar el libro. Intentá nuevamente.');
      }
      setSaveStatus('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleCoverUploaded = (asset: MediaAsset) => {
    updateField('coverMediaId', asset.id);
    if (!form.coverCaption) updateField('coverCaption', `Portada — ${form.title || asset.originalFilename}`);
  };

  const handleEbookUploaded = (upload: EbookUploadResponse) => {
    setForm((current) => ({
      ...current,
      fileSizeBytes: upload.sizeBytes,
      format: upload.mediaType === 'application/pdf' ? 'PDF' : 'EPUB',
    }));
    setSaveStatus('Archivo actualizado');
  };

  const title = savedBook?.title || form.title || 'Nuevo libro';

  return (
    <AdminLayout
      title={title}
      hideAvatar
      titleSlot={
        <div className={styles.headerLeft}>
          <Link to="/admin/libros" className={styles.backLink}>← Libros</Link>
          <h1 className={styles.headerTitle}>{title}</h1>
        </div>
      }
      headerActions={
        <div className={styles.headerActions}>
          <span className={styles.saveStatus}>{saveStatus}</span>
          <Button variant="secondary" disabled={saving} onClick={() => save('DRAFT')}>Guardar borrador</Button>
          <Button variant="primary" disabled={saving} onClick={() => save('PUBLISHED')}>Publicar</Button>
        </div>
      }
    >
      {saveError && <p className={styles.saveError} role="alert">{saveError}</p>}
      <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} />

      <div className={activeTab === 'manuscript' ? styles.contentWide : styles.content}>
        {activeTab === 'info' && <InformacionTab form={form} onChange={updateField} />}
        {activeTab === 'files' && (
          <ArchivoPortadaTab
            bookIdentifier={savedBook?.id ?? null}
            bookTitle={title}
            variant={form.variant}
            coverMediaId={form.coverMediaId}
            coverCaption={form.coverCaption}
            ebookFormat={form.format}
            ebookFileSizeBytes={form.fileSizeBytes}
            onCoverUploaded={handleCoverUploaded}
            onCoverCaptionChange={(value) => updateField('coverCaption', value)}
            onEbookUploaded={handleEbookUploaded}
          />
        )}
        {activeTab === 'manuscript' && <ManuscritoTab bookTitle={form.title || 'Nuevo libro'} />}
        {activeTab === 'page' && (
          <PaginaVentaTab
            bookId={savedBook?.id ?? null}
            slug={savedBook?.slug ?? ''}
            bookTitle={savedBook?.title ?? 'Nuevo libro'}
          />
        )}
        {activeTab === 'seo' && <SeoTab form={form} onChange={updateField} />}
      </div>
    </AdminLayout>
  );
}
