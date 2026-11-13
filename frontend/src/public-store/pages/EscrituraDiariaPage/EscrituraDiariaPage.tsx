import { useRef, useState } from 'react';
import { ToolLayout } from '../../components/ToolLayout/ToolLayout';
import { ToolPanel } from '../../components/ToolPanel/ToolPanel';
import { ChoiceChips } from '../../components/ChoiceChips/ChoiceChips';
import { SaveStatus } from '../../components/SaveStatus/SaveStatus';
import { Button } from '../../../shared/components/Button/Button';
import { Dialog } from '../../../shared/components/Dialog/Dialog';
import { downloadTextFile } from '../../../shared/utils/downloadText';
import { dayNumber, formatLongDate, formatShortDate, isDateKey, localDateKey } from '../../../shared/utils/localDate';
import { useToolEntries } from '../../hooks/useToolEntries';
import { MOODS, WRITING_PROMPTS, promptForDay } from '../../data/herramientas/writingPrompts';
import { GentleTimer } from './GentleTimer';
import styles from './EscrituraDiariaPage.module.css';

/** One written day is one entry of kind "day", keyed by its local date. */
const DAY = 'day';
/** Typing is saved in one request after a short pause, not per keystroke. */
const TYPING_DEBOUNCE_MS = 800;

interface DayData {
  prompt: string;
  mood: string | null;
  text: string;
}

interface JournalEntry extends DayData {
  date: string;
  updatedAt: string;
}

function isDayData(value: unknown): value is DayData {
  if (typeof value !== 'object' || value === null) return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.prompt === 'string' &&
    (data.mood === null || typeof data.mood === 'string') &&
    typeof data.text === 'string'
  );
}

const MOOD_OPTIONS = MOODS.map((mood) => ({ value: mood, label: mood }));

function hasContent(entry: JournalEntry): boolean {
  return entry.text.trim() !== '' || entry.mood !== null;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
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
  const store = useToolEntries('escritura-diaria');
  const [selectedDate, setSelectedDate] = useState(today);
  const [pendingDelete, setPendingDelete] = useState<string | 'all' | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const journal = new Map<string, JournalEntry>();
  for (const [date, stored] of Object.entries(store.entries[DAY] ?? {})) {
    if (isDateKey(date) && isDayData(stored.data)) {
      journal.set(date, { ...stored.data, date, updatedAt: stored.updatedAt });
    }
  }

  const entry: JournalEntry = journal.get(selectedDate) ?? {
    date: selectedDate,
    prompt: WRITING_PROMPTS[promptForDay(dayNumber(selectedDate))],
    mood: null,
    text: '',
    updatedAt: '',
  };

  const updateEntry = (patch: Partial<DayData>, debounceMs = 0) => {
    const next: DayData = { prompt: entry.prompt, mood: entry.mood, text: entry.text, ...patch };
    store.save(DAY, selectedDate, { ...next }, { debounceMs });
  };

  const nextPrompt = () => {
    const index = WRITING_PROMPTS.indexOf(entry.prompt);
    updateEntry({ prompt: WRITING_PROMPTS[(index + 1) % WRITING_PROMPTS.length] });
  };

  const openEntry = (date: string) => {
    setSelectedDate(date);
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const pastEntries = [...journal.values()].filter(hasContent).sort((a, b) => b.date.localeCompare(a.date));

  const confirmDelete = () => {
    if (pendingDelete === 'all') {
      store.removeAll();
      setSelectedDate(today);
    } else if (pendingDelete) {
      store.remove(DAY, pendingDelete);
    }
    setPendingDelete(null);
  };

  const isToday = selectedDate === today;
  const words = wordCount(entry.text);

  return (
    <ToolLayout
      tool="escritura-diaria"
      store={store}
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
            onChange={(event) => updateEntry({ text: event.target.value }, TYPING_DEBOUNCE_MS)}
            placeholder="Empezá por donde quieras…"
            rows={12}
            spellCheck
          />

          <div className={styles.status}>
            <span>
              {words} {words === 1 ? 'palabra' : 'palabras'}
            </span>
            <span aria-live="polite">
              <SaveStatus store={store} at={entry.updatedAt || undefined} />
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
