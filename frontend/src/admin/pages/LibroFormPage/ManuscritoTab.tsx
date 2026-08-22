import { useEffect, useRef, useState, type ClipboardEvent as ReactClipboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { Button } from '../../../shared/components/Button/Button';
import { Switch } from '../../../shared/components/Switch/Switch';
import { apiRequest, ApiError } from '../../../shared/api/client';
import { adminBookManuscriptUrl, adminBookManuscriptImportUrl, adminBookManuscriptExportUrl } from '../../../shared/config/api';
import { PageBreakOverlay } from './PageBreakOverlay';
import { DEFAULT_PAGE_SIZE_ID, PAGE_MARGIN_MM, PAGE_SIZES, findPageSize, pageContentHeightPx } from './pageSizes';
import {
  SECTION_KINDS,
  autoTitleFor,
  effectiveKind,
  effectiveTitleMode,
  sectionKindMeta,
  type SectionKind,
  type TitleMode,
} from './manuscriptSections';
import {
  IMAGE_WRAP_OPTIONS,
  applyWidthPct,
  applyWrap,
  closestImageFigure,
  figureMarkup,
  isInFront,
  markSelected,
  readImageFileAsDataURL,
  setFreePosition,
  setFront,
  widthPctOf,
  wrapOf,
  type ImageWrap,
} from './manuscriptImages';
import {
  ALIGN_COMMANDS,
  ALIGN_OPTIONS,
  FONT_SIZES,
  TEXT_COLORS,
  applyFontSize,
  applyTextColor,
  normalizeEditorDom,
  queryBlockFormat,
  queryState,
  runCommand,
  sanitizePastedHTML,
  wordCountOfHTML,
  type AlignValue,
} from './manuscriptFormatting';
import styles from './ManuscritoTab.module.css';

interface Chapter {
  id: number;
  title: string;
  html: string;
  kind?: SectionKind;
  titleMode?: TitleMode;
}

interface ManuscriptResponse {
  bookId: string;
  chapters: Chapter[];
  pageSize: string | null;
  updatedAt: string | null;
}

const AUTOSAVE_DEBOUNCE_MS = 1500;

/** Formatting currently in effect at the caret, reflected in the toolbar. */
interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  bulletList: boolean;
  numberList: boolean;
  align: AlignValue;
}

const NO_ACTIVE_FORMATS: ActiveFormats = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  bulletList: false,
  numberList: false,
  align: 'left',
};

function readActiveFormats(): ActiveFormats {
  let align: AlignValue = 'left';
  if (queryState('justifyCenter')) align = 'center';
  else if (queryState('justifyRight')) align = 'right';
  else if (queryState('justifyFull')) align = 'justify';
  return {
    bold: queryState('bold'),
    italic: queryState('italic'),
    underline: queryState('underline'),
    strike: queryState('strikeThrough'),
    bulletList: queryState('insertUnorderedList'),
    numberList: queryState('insertOrderedList'),
    align,
  };
}

/** Normalizes chapters loaded from the server (or freshly imported) to
 * always carry a resolved kind/titleMode — manuscripts saved before these
 * fields existed simply come back as CHAPTER/AUTO, which is exactly what
 * their title text already looked like under the old editor. */
function normalizeChapters(list: Chapter[]): Chapter[] {
  return list.map((chapter) => ({
    ...chapter,
    kind: effectiveKind(chapter.kind),
    titleMode: effectiveTitleMode(chapter.titleMode),
  }));
}

/** Recomputes `title` for every section whose titleMode is AUTO — kind and
 * position (relative to other sections of the same kind) are the only
 * inputs, so this must re-run after any add/remove/reorder/kind change,
 * not just when the section's own fields change. Sections with a custom
 * title are left untouched. */
function withResolvedTitles(list: Chapter[], bookTitle: string): Chapter[] {
  return list.map((chapter, index) =>
    effectiveTitleMode(chapter.titleMode) === 'CUSTOM'
      ? chapter
      : { ...chapter, title: autoTitleFor(list, index, bookTitle) },
  );
}

/** manuscriptImages.ts marks the currently-selected figure with this class
 * purely for the on-screen outline — strip it before it ever reaches saved
 * state, so a stray selection outline never gets autosaved/exported. */
function stripSelectionMarker(html: string): string {
  return html.replace(/\s?ms-image--selected/g, '');
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
 * A "chapter" is really a *section* — it can be a portada, a prólogo, a
 * capítulo, an epílogo, etc. (see manuscriptSections.ts) with either an
 * auto-generated label or a title the author typed themselves; only
 * SectionKind CHAPTER participates in "Capítulo N" numbering. Inline
 * images (manuscriptImages.ts) insert as a <figure data-wrap="..."> the
 * author can set to flow inline, centered, floated to a side, or freely
 * positioned/draggable in front of or behind the text.
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
  const [imageNotice, setImageNotice] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([{ id: 1, title: 'Capítulo 1', html: '', kind: 'CHAPTER', titleMode: 'AUTO' }]);
  const [activeChapter, setActiveChapter] = useState(0);
  const [newSectionKind, setNewSectionKind] = useState<SectionKind>('CHAPTER');
  const [exporting, setExporting] = useState<'EPUB' | 'PDF' | null>(null);
  const [exportMessage, setExportMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [pageSizeId, setPageSizeId] = useState(DEFAULT_PAGE_SIZE_ID);
  const [contentHeightPx, setContentHeightPx] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [selectedImage, setSelectedImage] = useState<HTMLElement | null>(null);
  const [imageVersion, setImageVersion] = useState(0);
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>(NO_ACTIVE_FORMATS);
  const [blockFormat, setBlockFormat] = useState('p');
  const [showColors, setShowColors] = useState(false);
  const [lastColor, setLastColor] = useState(TEXT_COLORS[0].value);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
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
  // Always-increasing, never reused — chapter ids used to be derived from
  // array length/position, which collides after a delete+add (e.g. delete
  // #2 of [1,2,3] then add: length-based id lands back on 3, an id already
  // in use). Filenames the PDF/EPUB export embeds images under lean on ids
  // being unique, so this matters for real now, not just cosmetically.
  const nextIdRef = useRef(2);

  const pageSize = findPageSize(pageSizeId);

  const updateChapters = (updater: (prev: Chapter[]) => Chapter[]) => {
    setChapters((prev) => withResolvedTitles(updater(prev), bookTitle));
  };

  // The chosen paper is part of the manuscript, not just a viewing
  // preference: PDF export renders those exact physical pages, so it has
  // to travel with every save.
  const pageSizeRef = useRef(pageSizeId);
  pageSizeRef.current = pageSizeId;

  const persistChapters = (value: Chapter[]) => {
    pendingChaptersRef.current = null;
    setSaveState('saving');
    return apiRequest(adminBookManuscriptUrl(bookId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapters: value, pageSize: pageSizeRef.current }),
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
        if (response.pageSize) setPageSizeId(response.pageSize);
        if (response.chapters.length > 0) {
          const normalized = normalizeChapters(response.chapters);
          nextIdRef.current = Math.max(1, ...normalized.map((c) => c.id)) + 1;
          skipNextAutosaveRef.current = true;
          setChapters(normalized);
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
    // pageSizeId is a dependency because it is saved alongside the
    // chapters — changing the paper has to persist on its own, without
    // waiting for the next keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bookId is stable per mount
  }, [chapters, manuscriptStarted, pageSizeId]);

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
        body: JSON.stringify({ chapters: chaptersToFlush, pageSize: pageSizeRef.current }),
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
      setSelectedImage(null);
    }
  }, [activeChapter, chapters]);

  // Dismiss the colour menu on any click outside it, the way a menu is
  // expected to behave — without this it stays open until re-clicked.
  useEffect(() => {
    if (!showColors) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(`.${styles.colorPicker}`)) {
        setShowColors(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showColors]);

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

  const handleFileUpload = async (file: File, mode: 'replace' | 'append' = 'replace') => {
    setConverting(true);
    setUploadNotice('');
    try {
      const body = new FormData();
      body.append('file', file);
      const response = await apiRequest<ManuscriptResponse>(adminBookManuscriptImportUrl(bookId, mode), {
        method: 'PUT',
        body,
      });
      const normalized = normalizeChapters(response.chapters);
      nextIdRef.current = Math.max(1, ...normalized.map((c) => c.id)) + 1;
      // The backend already persisted this import — hydrate local state
      // without re-triggering the autosave effect for a no-op re-save.
      skipNextAutosaveRef.current = true;
      setChapters(normalized);
      // Land on the first newly-imported section rather than jumping back
      // to the top of a manuscript the author was already deep into.
      setActiveChapter(mode === 'append' ? Math.max(0, chapters.length) : 0);
      setManuscriptStarted(true);
      if (mode === 'append') {
        setUploadNotice(`Se agregaron ${normalized.length - chapters.length} secciones.`);
      }
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

  const addSection = (kind: SectionKind) => {
    const id = nextIdRef.current++;
    const insertAt = chapters.length;
    updateChapters((prev) => [...prev, { id, title: '', html: '', kind, titleMode: 'AUTO' }]);
    setActiveChapter(insertAt);
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= chapters.length) return;
    updateChapters((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setActiveChapter(target);
  };

  const deleteSection = (index: number) => {
    if (chapters.length <= 1) return;
    updateChapters((prev) => prev.filter((_, i) => i !== index));
    setActiveChapter((current) => {
      if (current === index) return Math.max(0, index - 1);
      if (current > index) return current - 1;
      return current;
    });
  };

  const changeSectionKind = (index: number, kind: SectionKind) => {
    updateChapters((prev) => prev.map((c, i) => (i === index ? { ...c, kind } : c)));
  };

  const changeTitleMode = (index: number, mode: TitleMode) => {
    updateChapters((prev) => prev.map((c, i) => (i === index ? { ...c, titleMode: mode } : c)));
  };

  const changeCustomTitle = (index: number, title: string) => {
    updateChapters((prev) => prev.map((c, i) => (i === index ? { ...c, title } : c)));
  };

  const onEditorInput = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = stripSelectionMarker(editor.innerHTML);
    setChapters((prev) => prev.map((c, i) => (i === activeChapter ? { ...c, html } : c)));
  };

  const refreshToolbarState = () => {
    setActiveFormats(readActiveFormats());
    setBlockFormat(queryBlockFormat());
  };

  /**
   * Runs after a toolbar command or a paste — never on plain typing.
   * `normalizeEditorDom` rewrites nodes, which would move the caret if it
   * ran on every keystroke; it is only needed here anyway, since the
   * legacy `<font>` markup it folds away can only ever be produced by
   * execCommand in the first place.
   */
  const syncAfterCommand = () => {
    if (editorRef.current) normalizeEditorDom(editorRef.current);
    onEditorInput();
    refreshToolbarState();
  };

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    runCommand(command, value);
    syncAfterCommand();
  };

  // Pasting from Word, Docs or a web page otherwise drags in fixed pixel
  // fonts, background colours and wrapper soup that make the exported book
  // inconsistent with everything typed by hand.
  const onEditorPaste = (event: ReactClipboardEvent<HTMLDivElement>) => {
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    if (!html && !text) return;
    event.preventDefault();
    editorRef.current?.focus();
    if (html) {
      runCommand('insertHTML', sanitizePastedHTML(html));
    } else {
      runCommand('insertText', text);
    }
    syncAfterCommand();
  };

  const onEditorMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    const figure = closestImageFigure(event.target);
    if (selectedImage && selectedImage !== figure) markSelected(selectedImage, false);
    if (figure) markSelected(figure, true);
    setSelectedImage(figure);
    if (!figure || wrapOf(figure) !== 'free') return;
    const container = editorRef.current;
    if (!container) return;
    event.preventDefault();
    const rect = container.getBoundingClientRect();
    const onMove = (moveEvent: MouseEvent) => {
      const leftPct = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const topPct = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      setFreePosition(figure, leftPct, topPct);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      onEditorInput();
      setImageVersion((v) => v + 1);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const insertImage = async (file: File) => {
    setImageNotice('');
    try {
      const dataUrl = await readImageFileAsDataURL(file);
      editorRef.current?.focus();
      document.execCommand('insertHTML', false, figureMarkup(dataUrl));
      onEditorInput();
    } catch (error) {
      setImageNotice(error instanceof Error ? error.message : 'No pudimos insertar la imagen.');
    }
  };

  const withSelectedImage = (fn: (figure: HTMLElement) => void) => {
    if (!selectedImage) return;
    fn(selectedImage);
    onEditorInput();
    setImageVersion((v) => v + 1);
  };

  const removeSelectedImage = () => {
    if (!selectedImage) return;
    selectedImage.remove();
    setSelectedImage(null);
    onEditorInput();
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
          <p className={styles.startCardHint}>Aceptamos DOCX, PDF, TXT o EPUB. Si el archivo usa títulos, se separa en secciones automáticamente.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf,.txt,.epub"
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
  const activeIndex = activeChapter;
  const activeKind = effectiveKind(active?.kind);
  const activeTitleMode = effectiveTitleMode(active?.titleMode);
  const contentPerPage = pageContentHeightPx(pageSize);
  const pageCount = Math.max(1, Math.ceil(contentHeightPx / contentPerPage));
  const selectedWrap = selectedImage ? wrapOf(selectedImage) : null;
  const sectionWords = wordCountOfHTML(active?.html ?? '');
  const bookWords = chapters.reduce((total, chapter) => total + wordCountOfHTML(chapter.html), 0);

  return (
    <>
      <div className={styles.editorLayout}>
        {/* SECTION LIST */}
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
              {pageCount} hoja{pageCount === 1 ? '' : 's'} en esta sección
            </p>
          </div>

          <p className={styles.chapterListTitle}>Secciones</p>
          {chapters.map((chapter, index) => {
            const meta = sectionKindMeta(chapter.kind);
            return (
              <button
                key={chapter.id}
                type="button"
                onClick={() => setActiveChapter(index)}
                className={[styles.chapterItem, index === activeChapter ? styles.chapterItemActive : ''].join(' ')}
                title={meta.label}
              >
                <span className={styles.chapterItemGlyph} aria-hidden="true">
                  {meta.glyph}
                </span>
                <span
                  className={[styles.chapterItemLabel, chapter.title ? '' : styles.chapterItemUntitled].join(' ')}
                >
                  {chapter.title || 'Sin título'}
                </span>
              </button>
            );
          })}
          <div className={styles.addSectionRow}>
            <select
              className={styles.addSectionSelect}
              value={newSectionKind}
              onChange={(e) => setNewSectionKind(e.target.value as SectionKind)}
              aria-label="Tipo de nueva sección"
            >
              {SECTION_KINDS.map((entry) => (
                <option key={entry.kind} value={entry.kind}>
                  {entry.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.addSectionButton}
              onClick={() => addSection(newSectionKind)}
              aria-label="Agregar sección"
              title="Agregar sección"
            >
              +
            </button>
          </div>
        </div>

        {/* EDITOR */}
        <div className={styles.editorCol}>
          <div className={styles.sectionSettings}>
            <span className={styles.sectionSettingsLabel}>Sección</span>
            <select
              className={styles.sectionKindSelect}
              value={activeKind}
              onChange={(e) => changeSectionKind(activeIndex, e.target.value as SectionKind)}
              aria-label="Tipo de sección"
            >
              {SECTION_KINDS.map((entry) => (
                <option key={entry.kind} value={entry.kind}>
                  {entry.label}
                </option>
              ))}
            </select>
            <label className={styles.sectionTitleModeToggle}>
              <Switch
                checked={activeTitleMode === 'CUSTOM'}
                onChange={(checked) => changeTitleMode(activeIndex, checked ? 'CUSTOM' : 'AUTO')}
                label="Título personalizado"
              />
              Título personalizado
            </label>
            {activeTitleMode === 'CUSTOM' ? (
              <input
                type="text"
                className={styles.sectionTitleInput}
                value={active?.title ?? ''}
                onChange={(e) => changeCustomTitle(activeIndex, e.target.value)}
                placeholder="Escribí el título de esta sección…"
              />
            ) : (
              <span className={styles.sectionSettingsSpacer} />
            )}
            <button
              type="button"
              className={styles.sectionIconButton}
              onClick={() => moveSection(activeIndex, -1)}
              disabled={activeIndex === 0}
              aria-label="Mover antes"
              title="Mover antes"
            >
              ▲
            </button>
            <button
              type="button"
              className={styles.sectionIconButton}
              onClick={() => moveSection(activeIndex, 1)}
              disabled={activeIndex === chapters.length - 1}
              aria-label="Mover después"
              title="Mover después"
            >
              ▼
            </button>
            <button
              type="button"
              className={[styles.sectionIconButton, styles.sectionIconButtonDanger].join(' ')}
              onClick={() => deleteSection(activeIndex)}
              disabled={chapters.length <= 1}
              aria-label="Eliminar sección"
              title="Eliminar sección"
            >
              ✕
            </button>
          </div>

          {/* Pressing a toolbar button must not steal focus from the
              editor: a contentEditable that blurs can lose its selection,
              and the command would then apply to nothing. Selects and
              inputs are exempt — preventing their mousedown would stop
              them opening at all. */}
          <div
            className={styles.toolbar}
            onMouseDown={(event) => {
              if (event.target instanceof HTMLElement && event.target.closest('select, input')) return;
              event.preventDefault();
            }}
          >
            <button
              type="button"
              className={styles.toolbarButton}
              onClick={() => exec('undo')}
              aria-label="Deshacer"
              title="Deshacer (Ctrl+Z)"
            >
              ↶
            </button>
            <button
              type="button"
              className={styles.toolbarButton}
              onClick={() => exec('redo')}
              aria-label="Rehacer"
              title="Rehacer (Ctrl+Shift+Z)"
            >
              ↷
            </button>

            <div className={styles.toolbarDivider} />

            <select
              className={styles.toolbarSelect}
              value={blockFormat}
              onChange={(e) => exec('formatBlock', e.target.value)}
              aria-label="Estilo de párrafo"
            >
              <option value="p">Texto normal</option>
              <option value="h1">Título 1</option>
              <option value="h2">Título 2</option>
              <option value="h3">Título 3</option>
              <option value="blockquote">Cita</option>
            </select>
            <select
              className={styles.toolbarSelect}
              defaultValue="1em"
              onChange={(e) => {
                // execCommand acts on the selection, so the editor has to
                // hold focus again after the select stole it.
                editorRef.current?.focus();
                if (editorRef.current) applyFontSize(editorRef.current, e.target.value);
                syncAfterCommand();
              }}
              aria-label="Tamaño de texto"
            >
              {FONT_SIZES.map((size) => (
                <option key={size.value} value={size.value}>
                  {size.label}
                </option>
              ))}
            </select>

            <div className={styles.toolbarDivider} />

            <button
              type="button"
              className={[
                styles.toolbarButton,
                styles.toolbarButtonBold,
                activeFormats.bold ? styles.toolbarButtonActive : '',
              ].join(' ')}
              onClick={() => exec('bold')}
              aria-label="Negrita"
              aria-pressed={activeFormats.bold}
              title="Negrita (Ctrl+B)"
            >
              B
            </button>
            <button
              type="button"
              className={[
                styles.toolbarButton,
                styles.toolbarButtonItalic,
                activeFormats.italic ? styles.toolbarButtonActive : '',
              ].join(' ')}
              onClick={() => exec('italic')}
              aria-label="Itálica"
              aria-pressed={activeFormats.italic}
              title="Itálica (Ctrl+I)"
            >
              I
            </button>
            <button
              type="button"
              className={[
                styles.toolbarButton,
                styles.toolbarButtonUnderline,
                activeFormats.underline ? styles.toolbarButtonActive : '',
              ].join(' ')}
              onClick={() => exec('underline')}
              aria-label="Subrayado"
              aria-pressed={activeFormats.underline}
              title="Subrayado (Ctrl+U)"
            >
              U
            </button>
            <button
              type="button"
              className={[
                styles.toolbarButton,
                styles.toolbarButtonStrike,
                activeFormats.strike ? styles.toolbarButtonActive : '',
              ].join(' ')}
              onClick={() => exec('strikeThrough')}
              aria-label="Tachado"
              aria-pressed={activeFormats.strike}
              title="Tachado"
            >
              S
            </button>

            {/* Text colour. The swatch shows what would be applied, and the
                menu is a plain list of book-appropriate inks rather than a
                full picker — an arbitrary RGB wheel invites colours that
                print badly. */}
            <div className={styles.colorPicker}>
              <button
                type="button"
                className={styles.toolbarButton}
                onClick={() => setShowColors((open) => !open)}
                aria-label="Color del texto"
                aria-expanded={showColors}
                title="Color del texto"
              >
                <span className={styles.colorGlyph} aria-hidden="true">
                  A
                  <span className={styles.colorGlyphBar} style={{ background: lastColor }} />
                </span>
              </button>
              {showColors && (
                <div className={styles.colorMenu} role="menu">
                  {TEXT_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      role="menuitem"
                      className={styles.colorSwatch}
                      style={{ background: color.value }}
                      onClick={() => {
                        setLastColor(color.value);
                        setShowColors(false);
                        editorRef.current?.focus();
                        applyTextColor(color.value);
                        syncAfterCommand();
                      }}
                      aria-label={color.label}
                      title={color.label}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className={styles.toolbarDivider} />

            {/* Each alignment button draws its own alignment. They used to
                render byte-identical bar stacks, so all four looked like
                "left" and there was no way to tell them apart. */}
            {ALIGN_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={[
                  styles.toolbarButton,
                  activeFormats.align === option.value ? styles.toolbarButtonActive : '',
                ].join(' ')}
                onClick={() => exec(ALIGN_COMMANDS[option.value])}
                aria-label={option.label}
                aria-pressed={activeFormats.align === option.value}
                title={option.label}
              >
                <span
                  className={[styles.alignBars, styles[`alignBars_${option.value}`]].join(' ')}
                  aria-hidden="true"
                >
                  <span className={styles.alignBar} />
                  <span className={[styles.alignBar, styles.alignBarShort].join(' ')} />
                  <span className={styles.alignBar} />
                  <span className={[styles.alignBar, styles.alignBarShort].join(' ')} />
                </span>
              </button>
            ))}

            <div className={styles.toolbarDivider} />

            <button
              type="button"
              className={[styles.toolbarButton, activeFormats.bulletList ? styles.toolbarButtonActive : ''].join(' ')}
              onClick={() => exec('insertUnorderedList')}
              aria-label="Lista con viñetas"
              aria-pressed={activeFormats.bulletList}
              title="Lista con viñetas"
            >
              •≡
            </button>
            <button
              type="button"
              className={[styles.toolbarButton, activeFormats.numberList ? styles.toolbarButtonActive : ''].join(' ')}
              onClick={() => exec('insertOrderedList')}
              aria-label="Lista numerada"
              aria-pressed={activeFormats.numberList}
              title="Lista numerada"
            >
              1≡
            </button>
            <button
              type="button"
              className={[styles.toolbarButton, styles.toolbarButtonQuote].join(' ')}
              onClick={() => exec('formatBlock', 'blockquote')}
              aria-label="Cita"
              title="Cita"
            >
              "
            </button>
            <button
              type="button"
              className={styles.toolbarButton}
              onClick={() => exec('insertHorizontalRule')}
              aria-label="Separador"
              title="Separador"
            >
              —
            </button>

            <div className={styles.toolbarDivider} />

            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void insertImage(file);
                e.target.value = '';
              }}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className={styles.toolbarButton}
              onClick={() => imageInputRef.current?.click()}
              aria-label="Insertar imagen"
              title="Insertar imagen"
            >
              🖼
            </button>
            <button
              type="button"
              className={styles.toolbarButton}
              onClick={() => exec('removeFormat')}
              aria-label="Quitar formato"
              title="Quitar formato"
            >
              ⌫
            </button>

            <div className={styles.toolbarSpacer} />
            <Button variant="primary" onClick={() => setShowPreview(true)}>
              Vista previa
            </Button>
          </div>

          {imageNotice && <p className={styles.startCardHint}>{imageNotice}</p>}

          {selectedImage && selectedWrap && (
            // Keyed on imageVersion so a mutation applied straight to the
            // DOM (applyWrap/applyWidthPct/setFront all mutate selectedImage
            // in place, not through React state) is guaranteed to be
            // re-read on the next render instead of showing stale values.
            <div key={imageVersion} className={styles.imageToolbar}>
              <span className={styles.imageToolbarLabel}>Imagen</span>
              {IMAGE_WRAP_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={[styles.imageWrapButton, selectedWrap === option.value ? styles.imageWrapButtonActive : ''].join(' ')}
                  onClick={() => withSelectedImage((figure) => applyWrap(figure, option.value as ImageWrap))}
                >
                  {option.label}
                </button>
              ))}
              <label className={styles.imageWidthLabel}>
                Tamaño
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  className={styles.imageWidthRange}
                  value={widthPctOf(selectedImage)}
                  onChange={(e) => withSelectedImage((figure) => applyWidthPct(figure, Number(e.target.value)))}
                />
              </label>
              {selectedWrap === 'free' && (
                <button
                  type="button"
                  className={styles.imageWrapButton}
                  onClick={() => withSelectedImage((figure) => setFront(figure, !isInFront(figure)))}
                >
                  {isInFront(selectedImage) ? 'Delante del texto' : 'Detrás del texto'}
                </button>
              )}
              <span className={styles.imageToolbarSpacer} />
              <button type="button" className={styles.imageRemoveButton} onClick={removeSelectedImage}>
                Quitar imagen
              </button>
            </div>
          )}

          <div className={styles.canvas}>
            <div className={styles.editableWrapper} style={{ width: `${pageSize.widthMm}mm`, maxWidth: '100%' }}>
              <div
                ref={editorRef}
                contentEditable
                onInput={onEditorInput}
                onMouseDown={onEditorMouseDown}
                onPaste={onEditorPaste}
                onKeyUp={refreshToolbarState}
                onMouseUp={refreshToolbarState}
                onFocus={refreshToolbarState}
                className={styles.editable}
                style={{ width: `${pageSize.widthMm}mm`, maxWidth: '100%', padding: `${PAGE_MARGIN_MM}mm` }}
                suppressContentEditableWarning
              />
              <PageBreakOverlay pageSize={pageSize} contentHeightPx={contentHeightPx} />
            </div>
          </div>
          <p className={styles.wordCount}>
            {saveStatusText[saveState]} · {sectionWords.toLocaleString('es-AR')} palabras en esta sección ·{' '}
            {bookWords.toLocaleString('es-AR')} en todo el libro · {pageCount} hoja
            {pageCount === 1 ? '' : 's'} ({pageSize.label.split(' (')[0]}).
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
            Las secciones ya se guardan automáticamente. El EPUB/PDF generado se descarga para que lo revises antes
            de subirlo como archivo vendible en "Archivo y portada".
          </p>

          <div className={styles.exportSeparator} />
          <p className={styles.exportTitle}>Importar</p>
          <input
            ref={appendInputRef}
            type="file"
            accept=".docx,.pdf,.txt,.epub"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileUpload(file, 'append');
              e.target.value = '';
            }}
            style={{ display: 'none' }}
          />
          <Button
            variant="secondary"
            fullWidth
            onClick={() => appendInputRef.current?.click()}
            disabled={converting}
          >
            {converting ? 'Importando…' : 'Agregar desde archivo'}
          </Button>
          {uploadNotice && <p className={styles.exportMessage}>{uploadNotice}</p>}
          <p className={styles.exportHint}>
            Suma las secciones de un DOCX, PDF, TXT o EPUB al final del manuscrito, sin reemplazar lo ya escrito.
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
                {chapter.title && <h2 className={styles.previewChapterTitle}>{chapter.title}</h2>}
                {chapter.html ? (
                  // eslint-disable-next-line react/no-danger -- the author's own content, this same editing session
                  <div className={styles.previewChapterBody} dangerouslySetInnerHTML={{ __html: chapter.html }} />
                ) : (
                  <p className={[styles.previewChapterBody, styles.previewChapterEmpty].join(' ')}>
                    (Esta sección todavía no tiene contenido.)
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
