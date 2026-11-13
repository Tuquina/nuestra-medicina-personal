import { useRef, useState } from 'react';
import { ToolLayout } from '../../components/ToolLayout/ToolLayout';
import { ToolPanel } from '../../components/ToolPanel/ToolPanel';
import { ChoiceChips } from '../../components/ChoiceChips/ChoiceChips';
import { Button } from '../../../shared/components/Button/Button';
import { Dialog } from '../../../shared/components/Dialog/Dialog';
import { useLocalStorageState } from '../../../shared/hooks/useLocalStorageState';
import { downloadTextFile } from '../../../shared/utils/downloadText';
import { dayNumber, formatShortDate, isDateKey, localDateKey } from '../../../shared/utils/localDate';
import {
  REFLECTION_QUESTIONS,
  REFLECTION_THEMES,
  questionById,
  themeLabel,
  type ReflectionQuestion,
} from '../../data/herramientas/reflectionQuestions';
import styles from './PreguntasPage.module.css';

const STORAGE_KEY = 'nmp.herramientas.preguntas.v1';
const ALL_THEMES = 'todas';
const THEME_OPTIONS = [{ value: ALL_THEMES, label: 'Todas' }, ...REFLECTION_THEMES.map((t) => ({ value: t.id, label: t.label }))];

interface SavedAnswer {
  id: string;
  questionId: string;
  text: string;
  date: string;
}

interface ReflectionStore {
  favorites: string[];
  answers: SavedAnswer[];
}

const EMPTY_STORE: ReflectionStore = { favorites: [], answers: [] };

function isReflectionStore(value: unknown): value is ReflectionStore {
  if (typeof value !== 'object' || value === null) return false;
  const store = value as Record<string, unknown>;
  return (
    Array.isArray(store.favorites) &&
    store.favorites.every((id) => typeof id === 'string') &&
    Array.isArray(store.answers) &&
    store.answers.every((raw) => {
      if (typeof raw !== 'object' || raw === null) return false;
      const answer = raw as Record<string, unknown>;
      return (
        typeof answer.id === 'string' &&
        typeof answer.questionId === 'string' &&
        typeof answer.text === 'string' &&
        isDateKey(answer.date)
      );
    })
  );
}

function pickDifferent(pool: readonly ReflectionQuestion[], avoid: readonly string[]): ReflectionQuestion {
  const fresh = pool.filter((question) => !avoid.includes(question.id));
  const candidates = fresh.length > 0 ? fresh : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function answersAsText(answers: SavedAnswer[]): string {
  const blocks = answers.map((answer) =>
    [formatShortDate(answer.date), questionById(answer.questionId)?.text ?? '', '', answer.text.trim()].join('\n'),
  );
  return ['Preguntas para reflexionar · Nuestra Medicina Personal', '', ...blocks].join('\n\n────────\n\n');
}

/** `/herramientas/preguntas` */
export function PreguntasPage() {
  const [today] = useState(() => localDateKey(new Date()));
  const [store, setStore] = useLocalStorageState<ReflectionStore>(STORAGE_KEY, EMPTY_STORE, isReflectionStore);
  const [theme, setTheme] = useState<string>(ALL_THEMES);
  const [questionId, setQuestionId] = useState(
    () => REFLECTION_QUESTIONS[dayNumber(localDateKey(new Date())) % REFLECTION_QUESTIONS.length].id,
  );
  const [recent, setRecent] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | 'all' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const question = questionById(questionId) ?? REFLECTION_QUESTIONS[0];
  const isFavorite = store.favorites.includes(question.id);
  const pool = theme === ALL_THEMES ? REFLECTION_QUESTIONS : REFLECTION_QUESTIONS.filter((q) => q.theme === theme);

  const showQuestion = (next: ReflectionQuestion) => {
    setRecent((previous) => [question.id, ...previous].slice(0, 6));
    setQuestionId(next.id);
    setDraft('');
    setJustSaved(false);
  };

  const anotherQuestion = () => showQuestion(pickDifferent(pool, [question.id, ...recent]));

  const changeTheme = (value: string | null) => {
    const nextTheme = value ?? ALL_THEMES;
    setTheme(nextTheme);
    const nextPool =
      nextTheme === ALL_THEMES ? REFLECTION_QUESTIONS : REFLECTION_QUESTIONS.filter((q) => q.theme === nextTheme);
    showQuestion(pickDifferent(nextPool, [question.id]));
  };

  const toggleFavorite = () => {
    setStore((previous) => ({
      ...previous,
      favorites: previous.favorites.includes(question.id)
        ? previous.favorites.filter((id) => id !== question.id)
        : [question.id, ...previous.favorites],
    }));
  };

  const saveAnswer = () => {
    const text = draft.trim();
    if (!text) return;
    const answer: SavedAnswer = { id: `${Date.now()}`, questionId: question.id, text, date: today };
    setStore((previous) => ({ ...previous, answers: [answer, ...previous.answers] }));
    setDraft('');
    setJustSaved(true);
  };

  const openFavorite = (id: string) => {
    const next = questionById(id);
    if (!next) return;
    setTheme(ALL_THEMES);
    showQuestion(next);
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const removeFavorite = (id: string) =>
    setStore((previous) => ({ ...previous, favorites: previous.favorites.filter((favorite) => favorite !== id) }));

  const confirmDelete = () => {
    if (pendingDelete === 'all') {
      setStore((previous) => ({ ...previous, answers: [] }));
    } else if (pendingDelete) {
      setStore((previous) => ({ ...previous, answers: previous.answers.filter((a) => a.id !== pendingDelete) }));
    }
    setPendingDelete(null);
  };

  const favorites = store.favorites.map(questionById).filter((q): q is ReflectionQuestion => q !== undefined);

  return (
    <ToolLayout
      tool="preguntas"
      title="Preguntas para reflexionar"
      intro="Una pregunta a la vez, para mirar hacia adentro con calma. No hay respuestas correctas: podés solo pensarla, escribir unas líneas o guardarla para otro momento."
    >
      <div className={styles.themes}>
        <ChoiceChips label="Tema de las preguntas" options={THEME_OPTIONS} value={theme} onChange={changeTheme} />
      </div>

      <div ref={cardRef} className={styles.card}>
        <p className={styles.cardTheme}>{themeLabel(question.theme)}</p>
        <p key={question.id} className={styles.question} aria-live="polite">
          {question.text}
        </p>
        <div className={styles.cardActions}>
          <Button variant="primary" onClick={anotherQuestion}>
            Otra pregunta
          </Button>
          <button
            type="button"
            className={`${styles.favorite} ${isFavorite ? styles.favoriteOn : ''}`}
            aria-pressed={isFavorite}
            onClick={toggleFavorite}
          >
            <HeartIcon filled={isFavorite} />
            {isFavorite ? 'Guardada' : 'Guardar pregunta'}
          </button>
        </div>
      </div>

      <ToolPanel title="Tu respuesta" hint="Opcional. Escribí lo que surja, aunque sea una palabra.">
        <label htmlFor="reflection-answer" className="sr-only">
          Tu respuesta a la pregunta
        </label>
        <textarea
          id="reflection-answer"
          className={styles.answer}
          rows={6}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setJustSaved(false);
          }}
          placeholder="Me doy cuenta de que…"
        />
        <div className={styles.answerFooter}>
          <span className={styles.savedNote} aria-live="polite">
            {justSaved ? 'Guardada en tus respuestas.' : ''}
          </span>
          <Button variant="secondary" onClick={saveAnswer} disabled={!draft.trim()}>
            Guardar respuesta
          </Button>
        </div>
      </ToolPanel>

      {favorites.length > 0 && (
        <ToolPanel tone="plain" title="Preguntas guardadas" hint="Volvé a ellas cuando quieras.">
          <ul className={styles.favoritesList}>
            {favorites.map((favorite) => (
              <li key={favorite.id} className={styles.favoriteItem}>
                <button type="button" className={styles.favoriteOpen} onClick={() => openFavorite(favorite.id)}>
                  {favorite.text}
                </button>
                <button
                  type="button"
                  className={styles.removeButton}
                  aria-label={`Quitar de guardadas: ${favorite.text}`}
                  title="Quitar"
                  onClick={() => removeFavorite(favorite.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </ToolPanel>
      )}

      <ToolPanel
        tone="plain"
        title="Tus respuestas"
        hint={
          store.answers.length === 0
            ? 'Las respuestas que guardes van a aparecer acá, con su fecha.'
            : 'Releerlas con el tiempo también es parte del camino.'
        }
        actions={
          store.answers.length > 0 && (
            <>
              <Button
                variant="secondary"
                onClick={() => downloadTextFile(`preguntas-reflexion-${today}.txt`, answersAsText(store.answers))}
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
        {store.answers.length > 0 && (
          <ul className={styles.answersList}>
            {store.answers.map((answer) => (
              <li key={answer.id} className={styles.answerItem}>
                <div className={styles.answerHeader}>
                  <span className={styles.answerDate}>{formatShortDate(answer.date)}</span>
                  <button
                    type="button"
                    className={styles.removeButton}
                    aria-label="Borrar esta respuesta"
                    title="Borrar"
                    onClick={() => setPendingDelete(answer.id)}
                  >
                    ✕
                  </button>
                </div>
                <p className={styles.answerQuestion}>{questionById(answer.questionId)?.text}</p>
                <p className={styles.answerText}>{answer.text}</p>
              </li>
            ))}
          </ul>
        )}
      </ToolPanel>

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={pendingDelete === 'all' ? '¿Borrar todas tus respuestas?' : '¿Borrar esta respuesta?'}
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
            ? 'Se van a borrar todas las respuestas guardadas en este navegador. No se puede deshacer; si querés, descargalas antes.'
            : 'No se puede deshacer.'}
        </p>
      </Dialog>
    </ToolLayout>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" className={styles.heart}>
      <path
        d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
