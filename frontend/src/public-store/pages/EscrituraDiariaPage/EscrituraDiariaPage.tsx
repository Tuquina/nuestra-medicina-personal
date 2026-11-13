import { useRef, useState } from 'react';
import { ToolLayout } from '../../components/ToolLayout/ToolLayout';
import { ToolPanel } from '../../components/ToolPanel/ToolPanel';
import { ChoiceChips } from '../../components/ChoiceChips/ChoiceChips';
import { Button } from '../../../shared/components/Button/Button';
import { Dialog } from '../../../shared/components/Dialog/Dialog';
import { useLocalStorageState } from '../../../shared/hooks/useLocalStorageState';
import { downloadTextFile } from '../../../shared/utils/downloadText';
import { dayNumber, formatLongDate, formatShortDate, isDateKey, localDateKey } from '../../../shared/utils/localDate';
import { MOODS, WRITING_PROMPTS, promptForDay } from '../../data/herramientas/writingPrompts';
import { GentleTimer } from './GentleTimer';
import styles from './EscrituraDiariaPage.module.css';

const STORAGE_KEY = 'nmp.herramientas.escritura-diaria.v1';

interface JournalEntry {
  date: string;
  prompt: string;
  mood: string | null;
  text: string;
  updatedAt: string;
}

type Journal = Record<string, JournalEntry>;

function isJournal(value: unknown): value is Journal {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, raw]) => {
    if (!isDateKey(key) || typeof raw !== 'object' || raw === null) return false;
    const entry = raw as Record<string, unknown>;
    return (
      entry.date === key &&
      typeof entry.prompt === 'string' &&
      (entry.mood === null || typeof entry.mood === 'string') &&
      typeof entry.text === 'string' &&
      typeof entry.updatedAt === 'string'
    );
  });
}

const MOOD_OPTIONS = MOODS.map((mood) => ({ value: mood, label: mood }));

function hasContent(entry: JournalEntry): boolean {
  return entry.text.trim() !== '' || entry.mood !== null;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function savedTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

function journalAsText(entries: JournalEntry[]): string {
  const blocks = entries.map((entry) =>
    [
      formatLongDate(entry.date),
      entry.mood ? `Cómo llegué: ${entry.mood}` : null,
      `Consigna: ${entry.prompt}`,
      '',
      entry.text.trim(),
    ]
      .filter((line) => line !== null)
      .join('\n'),
  );
  return ['Registro de escritura diaria · Nuestra Medicina Personal', '', ...blocks].join('\n\n────────\n\n');
}

/** `/herramientas/escritura-diaria` */
export function EscrituraDiariaPage() {
  const [today] = useState(() => localDateKey(new Date()));
  const [journal, setJournal, { persisted }] = useLocalStorageState<Journal>(STORAGE_KEY, {}, isJournal);
  const [selectedDate, setSelectedDate] = useState(today);
  const [pendingDelete, setPendingDelete] = useState<string | 'all' | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const entry: JournalEntry = journal[selectedDate] ?? {
    date: selectedDate,
    prompt: WRITING_PROMPTS[promptForDay(dayNumber(selectedDate))],
    mood: null,
    text: '',
    updatedAt: '',
  };

  const updateEntry = (patch: Partial<Pick<JournalEntry, 'prompt' | 'mood' | 'text'>>) => {
    setJournal((previous) => {
      const current = previous[selectedDate] ?? entry;
      return { ...previous, [selectedDate]: { ...current, ...patch, updatedAt: new Date().toISOString() } };
    });
  };

  const nextPrompt = () => {
    const index = WRITING_PROMPTS.indexOf(entry.prompt);
    updateEntry({ prompt: WRITING_PROMPTS[(index + 1) % WRITING_PROMPTS.length] });
  };

  const openEntry = (date: string) => {
    setSelectedDate(date);
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const pastEntries = Object.values(journal)
    .filter(hasContent)
    .sort((a, b) => b.date.localeCompare(a.date));

  const confirmDelete = () => {
    if (pendingDelete === 'all') {
      setJournal({});
      setSelectedDate(today);
    } else if (pendingDelete) {
      setJournal((previous) => {
        const next = { ...previous };
        delete next[pendingDelete];
        return next;
      });
    }
    setPendingDelete(null);
  };

  const isToday = selectedDate === today;
  const words = wordCount(entry.text);

  return (
    <ToolLayout
      tool="escritura-diaria"
      persisted={persisted}
      title="Registro de escritura diaria"
      intro="Unos minutos para vos. Escribí sin corregir y sin juzgar: lo que aparezca está bien. Podés volver cada día y ver el camino recorrido."
    >
      <div ref={editorRef} className={styles.anchor}>
        <ToolPanel
          title={isToday ? `Hoy, ${formatLongDate(selectedDate)}` : formatLongDate(selectedDate)}
          hint={isToday ? undefined : 'Estás viendo un registro anterior. Podés seguir escribiéndolo.'}
          actions={
            !isToday && (
              <Button variant="secondary" onClick={() => setSelectedDate(today)}>
                Volver a hoy
              </Button>
            )
          }
        >
          <div className={styles.block}>
            <p className={styles.blockLabel}>¿Cómo llegás hoy?</p>
            <ChoiceChips
              label="¿Cómo llegás hoy?"
              options={MOOD_OPTIONS}
              value={entry.mood}
              onChange={(mood) => updateEntry({ mood })}
              allowClear
            />
          </div>

          <div className={styles.prompt}>
            <p className={styles.promptLabel}>Consigna</p>
            <p className={styles.promptText}>{entry.prompt}</p>
            <button type="button" className={styles.linkButton} onClick={nextPrompt}>
              Otra consigna
            </button>
          </div>

          <GentleTimer />

          <label htmlFor="journal-text" className="sr-only">
            Tu escritura
          </label>
          <textarea
            id="journal-text"
            className={styles.paper}
            value={entry.text}
            onChange={(event) => updateEntry({ text: event.target.value })}
            placeholder="Empezá por donde quieras…"
            rows={12}
            spellCheck
          />

          <div className={styles.status}>
            <span>
              {words} {words === 1 ? 'palabra' : 'palabras'}
            </span>
            <span aria-live="polite">
              {!entry.updatedAt
                ? ''
                : persisted
                  ? `Guardado en este navegador a las ${savedTimeLabel(entry.updatedAt)}`
                  : 'Sin guardar: descargalo antes de cerrar la página'}
            </span>
          </div>
        </ToolPanel>
      </div>

      <ToolPanel
        tone="plain"
        title="Tus días escritos"
        hint={
          pastEntries.length === 0
            ? 'Cuando escribas, tus registros van a aparecer acá.'
            : `${pastEntries.length} ${pastEntries.length === 1 ? 'día escrito' : 'días escritos'}. Elegí uno para releerlo o seguir escribiendo.`
        }
        actions={
          pastEntries.length > 0 && (
            <>
              <Button
                variant="secondary"
                onClick={() => downloadTextFile(`registro-escritura-${today}.txt`, journalAsText(pastEntries))}
              >
                Descargar (.txt)
              </Button>
              <Button variant="secondary" onClick={() => setPendingDelete('all')}>
                Borrar todo
              </Button>
            </>
          )
        }
      >
        {pastEntries.length > 0 && (
          <ul className={styles.entries}>
            {pastEntries.map((item) => (
              <li key={item.date} className={item.date === selectedDate ? styles.entryActive : styles.entry}>
                <button type="button" className={styles.entryOpen} onClick={() => openEntry(item.date)}>
                  <span className={styles.entryDate}>
                    {item.date === today ? 'Hoy' : formatShortDate(item.date)}
                    {item.mood && <span className={styles.entryMood}>{item.mood}</span>}
                  </span>
                  <span className={styles.entryExcerpt}>
                    {item.text.trim() ? item.text.trim().slice(0, 140) : 'Sin texto todavía.'}
                    {item.text.trim().length > 140 ? '…' : ''}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.entryDelete}
                  aria-label={`Borrar el registro del ${formatLongDate(item.date)}`}
                  title="Borrar"
                  onClick={() => setPendingDelete(item.date)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </ToolPanel>

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={pendingDelete === 'all' ? '¿Borrar todos tus registros?' : '¿Borrar este registro?'}
        actions={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Borrar
            </Button>
          </>
        }
      >
        <p>
          {pendingDelete === 'all'
            ? 'Se van a borrar todos los días escritos de este navegador. No se puede deshacer; si querés, descargalos antes.'
            : pendingDelete
              ? `Se va a borrar lo que escribiste el ${formatLongDate(pendingDelete)}. No se puede deshacer.`
              : ''}
        </p>
      </Dialog>
    </ToolLayout>
  );
}
