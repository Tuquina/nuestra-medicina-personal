import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/components/Button/Button';
import { apiRequest, ApiError } from '../../../shared/api/client';
import { adminBookManuscriptUrl, adminBookManuscriptImportUrl, adminBookManuscriptExportUrl } from '../../../shared/config/api';
import { PageBreakOverlay } from './PageBreakOverlay';
import { DEFAULT_PAGE_SIZE_ID, PAGE_MARGIN_MM, PAGE_SIZES, findPageSize, pageContentHeightPx } from './pageSizes';
import styles from './ManuscritoTab.module.css';

interface Chapter {
  id: number;
  title: string;
  html: string;
}

interface ManuscriptResponse {
  bookId: string;
  chapters: Chapter[];
  updatedAt: string | null;
}

const AUTOSAVE_DEBOUNCE_MS = 1500;

function wordCountOf(html: string): number {
  return html
    .replace(/<[^>]+>/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * The manuscript editor: upload-and-convert or start blank, then a
 * chapter-by-chapter rich text editor. Uses `contentEditable` + the
 * (deprecated but still functional, and exactly what the mockup itself
 * specifies) `document.execCommand` for formatting — same approach the
 * source design uses, kept uncontrolled like any contentEditable region
 * has to be in React: chapter HTML lives in state, but the live DOM is
 * only synced from it when switching chapters, not on every keystroke.
 *
 * Chapters persist for real via `GET/PUT /api/v1/admin/books/{id}/manuscript`
 * (autosaved, debounced). Uploading a file converts it server-side
 * (`PUT .../manuscript/import` — real DOCX/PDF/TXT parsing, ADR 0004) and
 * saves the result immediately. "Generar EPUB/PDF" downloads a real,
 * freshly generated file from `GET .../manuscript/export`; per ADR 0004 it
 * never auto-replaces the book's purchasable ebook — the admin reviews the
 * download and re-uploads it themselves via "Archivo y portada" if it's
 * good. Once a backend renders manuscript content *publicly*, that surface
 * must sanitize per architecture.md §40 — this admin preview modal, which
 * only ever reflects the author's own just-typed HTML from this session,
 * is a different surface.
 */
interface ManuscritoTabProps {
  bookId: string | null;
  bookTitle: string;
}

export function ManuscritoTab({ bookId, bookTitle }: ManuscritoTabProps) {
  if (!bookId) {
    return (
      <div className={styles.emptyCard}>
        <p className={styles.emptyText}>
          Guardá la información básica del libro antes de escribir el manuscrito.
        </p>
      </div>
    );
  }

  return <ManuscritoEditor bookId={bookId} bookTitle={bookTitle} />;
}

function ManuscritoEditor({ bookId, bookTitle }: { bookId: string; bookTitle: string }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [manuscriptStarted, setManuscriptStarted] = useState(false);
  const [converting, setConverting] = useState(false);
  const [uploadNotice, setUploadNotice] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([{ id: 1, title: 'Capítulo 1', html: '' }]);
  const [activeChapter, setActiveChapter] = useState(0);
  const [exporting, setExporting] = useState<'EPUB' | 'PDF' | null>(null);
  const [exportMessage, setExportMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [pageSizeId, setPageSizeId] = useState(DEFAULT_PAGE_SIZE_ID);
  const [contentHeightPx, setContentHeightPx] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  // Sentinel (no real chapter index) so the very first hydration — server
  // load or "start blank" — always performs one DOM sync, even though
  // activeChapter starts at 0 like any real chapter would.
  const previousChapterRef = useRef(-1);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosaveRef = useRef(true);
  // Tracks a debounced save that hasn't been sent yet, so an unmount mid-debounce
  // (switching tabs right after typing) can flush it instead of losing it.
  const pendingChaptersRef = useRef<Chapter[] | null>(null);

  const pageSize = findPageSize(pageSizeId);

  const persistChapters = (value: Chapter[]) => {
    pendingChaptersRef.current = null;
    setSaveState('saving');
    return apiRequest(adminBookManuscriptUrl(bookId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapters: value }),
    })
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('error'));
  };

  // Load whatever was already saved for this book (if anything).
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    apiRequest<ManuscriptResponse>(adminBookManuscriptUrl(bookId), { signal: controller.signal })
      .then((response) => {
        if (response.chapters.length > 0) {
          skipNextAutosaveRef.current = true;
          setChapters(response.chapters);
          setManuscriptStarted(true);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // A failed load must never fall through to the blank-start screen —
        // that would let autosave later overwrite a manuscript that's
        // actually still sitting on the server, unseen.
        setLoadError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per bookId/retry
  }, [bookId, loadAttempt]);

  // Debounced autosave — skips the run right after hydrating from the
  // server so loading a manuscript doesn't immediately re-save it.
  useEffect(() => {
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    if (!manuscriptStarted) return;
    pendingChaptersRef.current = chapters;
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(() => {
      autosaveTimeoutRef.current = null;
      void persistChapters(chapters);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bookId is stable per mount
  }, [chapters, manuscriptStarted]);

  // Unmount-only: if the debounce above never got to fire (e.g. the admin
  // switched tabs within AUTOSAVE_DEBOUNCE_MS of typing), flush the last
  // snapshot instead of silently losing it. Deliberately not in the effect
  // above — that one's cleanup runs on every keystroke too, and flushing
  // there would defeat the debounce.
  useEffect(() => {
    return () => {
      if (!pendingChaptersRef.current) return;
      const chaptersToFlush = pendingChaptersRef.current;
      pendingChaptersRef.current = null;
      // Fire-and-forget: the component is unmounting, so this deliberately
      // never touches saveState/other component state.
      void apiRequest(adminBookManuscriptUrl(bookId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapters: chaptersToFlush }),
      }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only flush; must read the latest ref, not re-subscribe per keystroke
  }, []);

  // Sync the contentEditable DOM only when the active chapter changes —
  // never on every keystroke, or the caret would jump on each input.
  useEffect(() => {
    if (previousChapterRef.current !== activeChapter && editorRef.current) {
      editorRef.current.innerHTML = chapters[activeChapter]?.html ?? '';
      previousChapterRef.current = activeChapter;
    }
  }, [activeChapter, chapters]);

  // Tracks the editable region's real height so the page-break overlay
  // (and the page count shown below it) stay accurate as the author
  // types, switches chapters, changes font size, or picks a different
  // page size — anything that changes how much text fits per line.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const measure = () => setContentHeightPx(el.scrollHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [manuscriptStarted, activeChapter, pageSizeId]);

  const handleFileUpload = async (file: File) => {
    setConverting(true);
    setUploadNotice('');
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await apiRequest<ManuscriptResponse>(adminBookManuscriptImportUrl(bookId), {
        method: 'PUT',
        body,
      });
      // The backend already persisted this import — hydrate local state
      // without re-triggering the autosave effect for a no-op re-save.
      skipNextAutosaveRef.current = true;
      setChapters(response.chapters);
      setActiveChapter(0);
      setManuscriptStarted(true);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'MANUSCRIPT_UNSUPPORTED_FORMAT') {
        setUploadNotice('Formato no soportado. Subí un archivo .txt, .docx o .pdf.');
      } else if (error instanceof ApiError && error.code === 'MANUSCRIPT_CONVERSION_FAILED') {
        setUploadNotice('No pudimos convertir ese archivo — puede estar dañado o vacío.');
      } else if (error instanceof ApiError && error.code === 'MANUSCRIPT_TOO_LARGE') {
        setUploadNotice('El archivo supera el límite de tamaño permitido.');
      } else {
        setUploadNotice('No pudimos convertir el archivo. Intentá nuevamente.');
      }
    } finally {
      setConverting(false);
    }
  };

  const startBlank = () => {
    skipNextAutosaveRef.current = false;
    setManuscriptStarted(true);
  };

  const addChapter = () => {
    setChapters((prev) => {
      const n = prev.length + 1;
      return [...prev, { id: n, title: `Capítulo ${n}`, html: '' }];
    });
    setActiveChapter(chapters.length);
  };

  const onEditorInput = () => {
    const html = editorRef.current?.innerHTML ?? '';
    setChapters((prev) => prev.map((c, i) => (i === activeChapter ? { ...c, html } : c)));
  };

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const generate = async (kind: 'EPUB' | 'PDF') => {
    setExporting(kind);
    setExportMessage(`Generando ${kind}…`);
    try {
      const response = await fetch(adminBookManuscriptExportUrl(bookId, kind === 'EPUB' ? 'epub' : 'pdf'), {
        credentials: 'include',
      });
      if (!response.ok) {
        let code = 'HTTP_ERROR';
        try {
          const body = (await response.json()) as { error?: { code?: string } };
          code = body.error?.code ?? code;
        } catch {
          // non-JSON error body — fall through to the generic message
        }
        setExportMessage(
          code === 'MANUSCRIPT_CONVERSION_FAILED'
            ? `No pudimos generar el ${kind}. Revisá el contenido de los capítulos.`
            : `No pudimos generar el ${kind}. Intentá nuevamente.`,
        );
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const filenameMatch = /filename="?([^";]+)"?/.exec(disposition);
      const filename = filenameMatch?.[1] ?? (kind === 'EPUB' ? 'manuscrito.epub' : 'manuscrito.pdf');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportMessage(`${filename} generado y descargado.`);
    } catch {
      setExportMessage(`No pudimos generar el ${kind}. Intentá nuevamente.`);
    } finally {
      setExporting(null);
    }
  };

  const saveStatusText: Record<SaveState, string> = {
    idle: 'Guardado automático activado',
    saving: 'Guardando…',
    saved: 'Guardado',
    error: 'No pudimos guardar — reintentando en tu próximo cambio',
  };

  if (loadError) {
    return (
      <div className={styles.converting}>
        <p style={{ marginBottom: 12 }}>No pudimos cargar el manuscrito guardado. Podría haber contenido sin mostrar.</p>
        <Button variant="secondary" onClick={() => setLoadAttempt((n) => n + 1)}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (loading) {
    return <div className={styles.converting}>Cargando manuscrito…</div>;
  }

  if (!manuscriptStarted) {
    return converting ? (
      <div className={styles.converting}>Convirtiendo el archivo…</div>
    ) : (
      <div className={styles.startGrid}>
        <div className={styles.startCardDashed}>
          <p className={styles.startCardTitle}>Subir un archivo existente</p>
          <p className={styles.startCardHint}>Aceptamos DOCX, PDF o TXT.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileUpload(file);
              e.target.value = '';
            }}
            style={{ display: 'none' }}
          />
          <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
            Elegir archivo
          </Button>
          {uploadNotice && <p className={styles.startCardHint}>{uploadNotice}</p>}
        </div>
        <div className={styles.startCard}>
          <p className={styles.startCardTitle}>Empezar a escribir</p>
          <p className={styles.startCardHint}>Redactá tu libro directamente en el editor.</p>
          <Button variant="secondary" onClick={startBlank}>
            Abrir editor en blanco
          </Button>
        </div>
      </div>
    );
  }

  const active = chapters[activeChapter];
  const contentPerPage = pageContentHeightPx(pageSize);
  const pageCount = Math.max(1, Math.ceil(contentHeightPx / contentPerPage));

  return (
    <>
      <div className={styles.editorLayout}>
        {/* CHAPTER LIST */}
        <div className={styles.chapterList}>
          <div className={styles.pageSizeBlock}>
            <label htmlFor="pageSize" className={styles.chapterListTitle} style={{ margin: 0 }}>
              Tamaño de hoja
            </label>
            <select
              id="pageSize"
              className={styles.pageSizeSelect}
              value={pageSizeId}
              onChange={(e) => setPageSizeId(e.target.value)}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.label}
                </option>
              ))}
            </select>
            <p className={styles.pageCountHint}>
              {pageCount} hoja{pageCount === 1 ? '' : 's'} en este capítulo
            </p>
          </div>

          <p className={styles.chapterListTitle}>Capítulos</p>
          {chapters.map((chapter, index) => (
            <button
              key={chapter.id}
              type="button"
              onClick={() => setActiveChapter(index)}
              className={[styles.chapterItem, index === activeChapter ? styles.chapterItemActive : ''].join(' ')}
            >
              {chapter.title}
            </button>
          ))}
          <button type="button" className={styles.addChapter} onClick={addChapter}>
            + Agregar capítulo
          </button>
        </div>

        {/* EDITOR */}
        <div className={styles.editorCol}>
          <div className={styles.toolbar}>
            <select className={styles.toolbarSelect} onChange={(e) => exec('formatBlock', e.target.value)} defaultValue="P">
              <option value="P">Texto normal</option>
              <option value="H1">Título 1</option>
              <option value="H2">Título 2</option>
              <option value="H3">Título 3</option>
              <option value="BLOCKQUOTE">Cita</option>
            </select>
            <select className={styles.toolbarSelect} onChange={(e) => exec('fontName', e.target.value)} defaultValue="Newsreader">
              <option value="Newsreader">Newsreader</option>
              <option value="Public Sans">Public Sans</option>
              <option value="Georgia">Georgia</option>
              <option value="ui-monospace">Monoespaciada</option>
            </select>
            <select className={styles.toolbarSelect} onChange={(e) => exec('fontSize', e.target.value)} defaultValue="3">
              <option value="2">Pequeño</option>
              <option value="3">Normal</option>
              <option value="5">Grande</option>
              <option value="6">Muy grande</option>
            </select>

            <div className={styles.toolbarDivider} />

            <button
              type="button"
              className={[styles.toolbarButton, styles.toolbarButtonBold].join(' ')}
              onClick={() => exec('bold')}
              aria-label="Negrita"
            >
              B
            </button>
            <button
              type="button"
              className={[styles.toolbarButton, styles.toolbarButtonItalic].join(' ')}
              onClick={() => exec('italic')}
              aria-label="Itálica"
            >
              I
            </button>
            <button
              type="button"
              className={[styles.toolbarButton, styles.toolbarButtonUnderline].join(' ')}
              onClick={() => exec('underline')}
              aria-label="Subrayado"
            >
              U
            </button>

            <div className={styles.toolbarDivider} />

            {(['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'] as const).map((command) => (
              <button
                key={command}
                type="button"
                className={styles.toolbarButton}
                onClick={() => exec(command)}
                aria-label={command}
              >
                <span className={styles.alignBars} aria-hidden="true">
                  <span className={styles.alignBar} style={{ width: 14 }} />
                  <span className={styles.alignBar} style={{ width: 10 }} />
                  <span className={styles.alignBar} style={{ width: 12 }} />
                </span>
              </button>
            ))}

            <div className={styles.toolbarDivider} />

            <button type="button" className={styles.toolbarButton} onClick={() => exec('insertUnorderedList')} aria-label="Lista">
              ≡
            </button>
            <button
              type="button"
              className={[styles.toolbarButton, styles.toolbarButtonQuote].join(' ')}
              onClick={() => exec('formatBlock', 'BLOCKQUOTE')}
              aria-label="Cita"
            >
              "
            </button>

            <div className={styles.toolbarSpacer} />
            <Button variant="primary" onClick={() => setShowPreview(true)}>
              Vista previa
            </Button>
          </div>

          <div className={styles.canvas}>
            <div className={styles.editableWrapper} style={{ width: `${pageSize.widthMm}mm`, maxWidth: '100%' }}>
              <div
                ref={editorRef}
                contentEditable
                onInput={onEditorInput}
                className={styles.editable}
                style={{ width: `${pageSize.widthMm}mm`, maxWidth: '100%', padding: `${PAGE_MARGIN_MM}mm` }}
                suppressContentEditableWarning
              />
              <PageBreakOverlay pageSize={pageSize} contentHeightPx={contentHeightPx} />
            </div>
          </div>
          <p className={styles.wordCount}>
            {saveStatusText[saveState]} · {wordCountOf(active?.html ?? '')} palabras · {pageCount} hoja
            {pageCount === 1 ? '' : 's'} ({pageSize.label.split(' (')[0]}) en este capítulo.
          </p>
        </div>

        {/* EXPORT PANEL */}
        <div className={styles.exportPanel}>
          <p className={styles.exportTitle}>Convertir y guardar</p>
          <Button
            variant="secondary"
            fullWidth
            style={{ marginBottom: 8 }}
            onClick={() => generate('EPUB')}
            disabled={exporting !== null}
          >
            {exporting === 'EPUB' ? 'Generando…' : 'Generar EPUB'}
          </Button>
          <Button variant="secondary" fullWidth onClick={() => generate('PDF')} disabled={exporting !== null}>
            {exporting === 'PDF' ? 'Generando…' : 'Generar PDF'}
          </Button>
          {exportMessage && <p className={styles.exportMessage}>{exportMessage}</p>}
          <p className={styles.exportHint}>
            Los capítulos ya se guardan automáticamente. El EPUB/PDF generado se descarga para que lo revises antes
            de subirlo como archivo vendible en "Archivo y portada".
          </p>
        </div>
      </div>

      {/* PREVIEW MODAL */}
      {showPreview && (
        <div className={styles.previewBackdrop} onClick={() => setShowPreview(false)}>
          <div className={styles.previewCard} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.previewClose}
              onClick={() => setShowPreview(false)}
              aria-label="Cerrar vista previa"
            >
              ✕
            </button>
            <p className={styles.previewEyebrow}>Vista previa</p>
            <h1 className={styles.previewTitle}>{bookTitle}</h1>
            {chapters.map((chapter) => (
              <div key={chapter.id} className={styles.previewChapter}>
                <h2 className={styles.previewChapterTitle}>{chapter.title}</h2>
                {chapter.html ? (
                  // eslint-disable-next-line react/no-danger -- the author's own content, this same editing session
                  <div className={styles.previewChapterBody} dangerouslySetInnerHTML={{ __html: chapter.html }} />
                ) : (
                  <p className={[styles.previewChapterBody, styles.previewChapterEmpty].join(' ')}>
                    (Este capítulo todavía no tiene contenido.)
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
