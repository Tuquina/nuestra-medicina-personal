import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/components/Button/Button';
import { apiRequest } from '../../../shared/api/client';
import { adminBookManuscriptUrl } from '../../../shared/config/api';
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
const CONVERTIBLE_EXTENSION = '.txt';

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
 * (autosaved, debounced). Real conversion is only implemented for plain
 * text uploads (`file.text()`); other formats and "Generar EPUB/PDF" are
 * honestly marked as not available yet rather than faking success —
 * architecture.md doesn't define a real conversion/generation pipeline,
 * and building one is a bigger, separate decision (new dependencies, an
 * ADR) than this pass covers. Once a backend renders manuscript content
 * *publicly*, that surface must sanitize per architecture.md §40 — this
 * admin preview modal, which only ever reflects the author's own
 * just-typed HTML from this session, is a different surface.
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
  const [manuscriptStarted, setManuscriptStarted] = useState(false);
  const [uploadNotice, setUploadNotice] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([{ id: 1, title: 'Capítulo 1', html: '' }]);
  const [activeChapter, setActiveChapter] = useState(0);
  const [exportMessage, setExportMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [pageSizeId, setPageSizeId] = useState(DEFAULT_PAGE_SIZE_ID);
  const [contentHeightPx, setContentHeightPx] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const previousChapterRef = useRef(activeChapter);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosaveRef = useRef(true);

  const pageSize = findPageSize(pageSizeId);

  // Load whatever was already saved for this book (if anything).
  useEffect(() => {
    const controller = new AbortController();
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
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per bookId
  }, [bookId]);

  // Debounced autosave — skips the run right after hydrating from the
  // server so loading a manuscript doesn't immediately re-save it.
  useEffect(() => {
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    if (!manuscriptStarted) return;
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(() => {
      setSaveState('saving');
      apiRequest(adminBookManuscriptUrl(bookId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapters }),
      })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bookId is stable per mount
  }, [chapters, manuscriptStarted]);

  // Sync the contentEditable DOM only when the active chapter changes —
  // never on every keystroke, or the caret would jump on each input.
  useEffect(() => {
    if (previousChapterRef.current !== activeChapter && editorRef.current) {
      editorRef.current.innerHTML = chapters[activeChapter]?.html ?? '';
    }
    previousChapterRef.current = activeChapter;
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
    if (!file.name.toLowerCase().endsWith(CONVERTIBLE_EXTENSION)) {
      setUploadNotice(
        'La conversión automática de DOCX/PDF todavía no está disponible. Subí un archivo .txt o empezá a escribir directamente.',
      );
      return;
    }
    setUploadNotice('');
    const text = await file.text();
    const html = text
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
      .join('');
    skipNextAutosaveRef.current = false;
    setChapters([{ id: 1, title: 'Capítulo 1', html }]);
    setActiveChapter(0);
    setManuscriptStarted(true);
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

  const generate = (kind: 'EPUB' | 'PDF') => {
    setExportMessage(`La generación de ${kind} todavía no está disponible.`);
  };

  const saveStatusText: Record<SaveState, string> = {
    idle: 'Guardado automático activado',
    saving: 'Guardando…',
    saved: 'Guardado',
    error: 'No pudimos guardar — reintentando en tu próximo cambio',
  };

  if (loading) {
    return <div className={styles.converting}>Cargando manuscrito…</div>;
  }

  if (!manuscriptStarted) {
    return (
      <div className={styles.startGrid}>
        <div className={styles.startCardDashed}>
          <p className={styles.startCardTitle}>Subir un archivo existente</p>
          <p className={styles.startCardHint}>Por ahora convertimos automáticamente sólo archivos TXT.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".doc,.docx,.pdf,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileUpload(file);
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
          <Button variant="secondary" fullWidth style={{ marginBottom: 8 }} onClick={() => generate('EPUB')}>
            Generar EPUB
          </Button>
          <Button variant="secondary" fullWidth onClick={() => generate('PDF')}>
            Generar PDF
          </Button>
          {exportMessage && <p className={styles.exportMessage}>{exportMessage}</p>}
          <p className={styles.exportHint}>
            Los capítulos ya se guardan automáticamente. La generación de EPUB/PDF es una función futura.
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
