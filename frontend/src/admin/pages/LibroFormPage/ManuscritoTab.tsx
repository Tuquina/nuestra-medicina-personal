import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/components/Button/Button';
import styles from './ManuscritoTab.module.css';

interface Chapter {
  id: number;
  title: string;
  html: string;
}

const PLACEHOLDER_CONVERTED =
  '<p>Este es un texto de ejemplo que representa el contenido convertido desde tu archivo. Reemplazalo por el contenido real de tu libro.</p>';

function wordCountOf(html: string): number {
  return html
    .replace(/<[^>]+>/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * The manuscript editor: upload-and-convert or start blank, then a
 * chapter-by-chapter rich text editor. Uses `contentEditable` + the
 * (deprecated but still functional, and exactly what the mockup itself
 * specifies) `document.execCommand` for formatting — same approach the
 * source design uses, kept uncontrolled like any contentEditable region
 * has to be in React: chapter HTML lives in state, but the live DOM is
 * only synced from it when switching chapters, not on every keystroke.
 *
 * "Generar EPUB/PDF" simulate the real conversion pipeline
 * (architecture.md doesn't define one yet); the preview modal renders
 * the author's own just-typed HTML from this same session — once a
 * backend persists manuscript content, whatever renders it *publicly*
 * must sanitize per architecture.md §40, but that's a different
 * surface than the admin reflecting back what you just typed.
 */
interface ManuscritoTabProps {
  bookTitle: string;
}

export function ManuscritoTab({ bookTitle }: ManuscritoTabProps) {
  const [manuscriptStarted, setManuscriptStarted] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [chapters, setChapters] = useState<Chapter[]>([{ id: 1, title: 'Capítulo 1', html: '' }]);
  const [activeChapter, setActiveChapter] = useState(0);
  const [exportMessage, setExportMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const previousChapterRef = useRef(activeChapter);

  // Sync the contentEditable DOM only when the active chapter changes —
  // never on every keystroke, or the caret would jump on each input.
  useEffect(() => {
    if (previousChapterRef.current !== activeChapter && editorRef.current) {
      editorRef.current.innerHTML = chapters[activeChapter]?.html ?? '';
    }
    previousChapterRef.current = activeChapter;
  }, [activeChapter, chapters]);

  const handleFileUpload = (file: File) => {
    setIsConverting(true);
    setUploadedFileName(file.name);
    setTimeout(() => {
      setIsConverting(false);
      setManuscriptStarted(true);
      setChapters([{ id: 1, title: 'Capítulo 1', html: PLACEHOLDER_CONVERTED }]);
      setActiveChapter(0);
    }, 1200);
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
    setExportMessage(`Generando ${kind}…`);
    setTimeout(() => {
      const filename = kind === 'EPUB' ? 'el-libro.epub' : 'el-libro.pdf';
      setExportMessage(`${filename} generado (demo) — guardado en Archivo y portada.`);
    }, 900);
  };

  if (!manuscriptStarted) {
    return isConverting ? (
      <div className={styles.converting}>Convirtiendo "{uploadedFileName}" a texto editable…</div>
    ) : (
      <div className={styles.startGrid}>
        <div className={styles.startCardDashed}>
          <p className={styles.startCardTitle}>Subir un archivo existente</p>
          <p className={styles.startCardHint}>Aceptamos DOCX, DOC, PDF o TXT.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".doc,.docx,.pdf,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
            style={{ display: 'none' }}
          />
          <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
            Elegir archivo
          </Button>
        </div>
        <div className={styles.startCard}>
          <p className={styles.startCardTitle}>Empezar a escribir</p>
          <p className={styles.startCardHint}>Redactá tu libro directamente en el editor.</p>
          <Button variant="secondary" onClick={() => setManuscriptStarted(true)}>
            Abrir editor en blanco
          </Button>
        </div>
      </div>
    );
  }

  const active = chapters[activeChapter];

  return (
    <>
      <div className={styles.editorLayout}>
        {/* CHAPTER LIST */}
        <div className={styles.chapterList}>
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
            <div
              ref={editorRef}
              contentEditable
              onInput={onEditorInput}
              className={styles.editable}
              suppressContentEditableWarning
            />
          </div>
          <p className={styles.wordCount}>
            Guardado automático activado · {wordCountOf(active?.html ?? '')} palabras en este capítulo.
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
            El archivo generado se guarda en la pestaña "Archivo y portada".
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
