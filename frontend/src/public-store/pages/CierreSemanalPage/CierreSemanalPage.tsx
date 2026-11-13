import { useEffect, useRef, useState } from 'react';
import { ToolLayout } from '../../components/ToolLayout/ToolLayout';
import { ToolPanel } from '../../components/ToolPanel/ToolPanel';
import { Button } from '../../../shared/components/Button/Button';
import { Dialog } from '../../../shared/components/Dialog/Dialog';
import { downloadTextFile } from '../../../shared/utils/downloadText';
import { isDateKey, localDateKey, weekRangeOf, type WeekRange } from '../../../shared/utils/localDate';
import { useToolEntries } from '../../hooks/useToolEntries';
import { BreathingGuide } from './BreathingGuide';
import styles from './CierreSemanalPage.module.css';

/**
 * Entries, keyed by the week's Monday: "draft" is the ritual in progress,
 * "closure" the saved result. Saving a closure removes its draft, so the
 * same text is never kept twice.
 */
const DRAFT = 'draft';
const CLOSURE = 'closure';
const TYPING_DEBOUNCE_MS = 800;

const STEPS = ['Llegar', 'Respirar', 'Mirar la semana', 'Agradecer', 'Soltar', 'Intención', 'Cerrar'] as const;
const LAST_STEP = STEPS.length - 1;

interface ClosureFields {
  moments: string[];
  gratitude: string[];
  intention: string;
  care: string;
}

interface Closure extends ClosureFields {
  weekKey: string;
  weekLabel: string;
  savedAt: string;
}

const emptyFields = (): ClosureFields => ({ moments: ['', '', ''], gratitude: ['', '', ''], intention: '', care: '' });

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isClosureFields(value: unknown): value is ClosureFields {
  if (typeof value !== 'object' || value === null) return false;
  const fields = value as Record<string, unknown>;
  return (
    isStringArray(fields.moments) &&
    isStringArray(fields.gratitude) &&
    typeof fields.intention === 'string' &&
    typeof fields.care === 'string'
  );
}

function pickFields(fields: ClosureFields): ClosureFields {
  return { moments: fields.moments, gratitude: fields.gratitude, intention: fields.intention, care: fields.care };
}

function filled(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

function closureAsText(closure: Closure): string {
  const lines = [closure.weekLabel, ''];
  const moments = filled(closure.moments);
  const gratitude = filled(closure.gratitude);
  if (moments.length) lines.push('Momentos de la semana:', ...moments.map((m) => `· ${m}`), '');
  if (gratitude.length) lines.push('Agradezco:', ...gratitude.map((g) => `· ${g}`), '');
  if (closure.intention.trim()) lines.push(`Intención para la próxima semana: ${closure.intention.trim()}`);
  if (closure.care.trim()) lines.push(`Un gesto de cuidado para mí: ${closure.care.trim()}`);
  return lines.join('\n');
}

function closuresAsText(closures: Closure[]): string {
  return ['Ritual de cierre semanal · Nuestra Medicina Personal', '', ...closures.map(closureAsText)].join(
    '\n\n────────\n\n',
  );
}

/** `/herramientas/cierre-semanal` */
export function CierreSemanalPage() {
  const [week] = useState<WeekRange>(() => weekRangeOf(new Date()));
  const store = useToolEntries('cierre-semanal');
  const [step, setStep] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const ritualRef = useRef<HTMLDivElement>(null);

  const closures: Closure[] = Object.entries(store.entries[CLOSURE] ?? {})
    .filter(([weekKey, stored]) => isDateKey(weekKey) && isClosureFields(stored.data))
    .map(([weekKey, stored]) => {
      const data = stored.data as ClosureFields & { weekLabel?: unknown };
      return {
        ...pickFields(data),
        weekKey,
        weekLabel: typeof data.weekLabel === 'string' ? data.weekLabel : weekRangeOf(new Date(`${weekKey}T12:00:00`)).label,
        savedAt: stored.updatedAt,
      };
    })
    .sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  const savedThisWeek = closures.find((closure) => closure.weekKey === week.startKey);

  // This week's ritual: the draft in progress, else the saved closure, else empty.
  const storedDraft = store.entries[DRAFT]?.[week.startKey]?.data;
  const draft: ClosureFields = isClosureFields(storedDraft)
    ? pickFields(storedDraft)
    : savedThisWeek
      ? pickFields(savedThisWeek)
      : emptyFields();

  const updateDraft = (patch: Partial<ClosureFields>) =>
    store.save(DRAFT, week.startKey, { ...draft, ...patch }, { debounceMs: TYPING_DEBOUNCE_MS });

  const updateListItem = (field: 'moments' | 'gratitude', index: number, value: string) => {
    const next = [...draft[field]];
    next[index] = value;
    updateDraft(field === 'moments' ? { moments: next } : { gratitude: next });
  };

  const goTo = (next: number) => {
    setStep(Math.min(Math.max(next, 0), LAST_STEP));
    ritualRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const currentClosure: Closure = {
    ...draft,
    weekKey: week.startKey,
    weekLabel: week.label,
    savedAt: savedThisWeek?.savedAt ?? '',
  };

  const saveClosure = () => {
    store.save(CLOSURE, week.startKey, { ...draft, weekLabel: week.label });
    store.remove(DRAFT, week.startKey);
  };

  const startOver = () => {
    // An explicit empty draft, so a saved closure doesn't refill the ritual.
    store.save(DRAFT, week.startKey, { ...emptyFields() });
    goTo(0);
  };

  const confirmDelete = () => {
    if (pendingDelete) {
      // Delete the draft of that week too: otherwise the "deleted" text
      // would reappear when walking the ritual again.
      store.remove(CLOSURE, pendingDelete);
      store.remove(DRAFT, pendingDelete);
    }
    setPendingDelete(null);
  };

  return (
    <ToolLayout
      tool="cierre-semanal"
      store={store}
      title="Ritual de cierre semanal"
      intro="Un recorrido breve para despedir la semana con calma: respirar, mirar lo vivido, agradecer, soltar lo que pesa y elegir con qué intención empezar la próxima."
    >
      <div ref={ritualRef} className={styles.ritual}>
        <p className={styles.week}>{week.label}</p>

        <ol className={styles.steps} aria-label="Pasos del ritual">
          {STEPS.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                className={`${styles.stepDot} ${index === step ? styles.stepCurrent : ''} ${index < step ? styles.stepDone : ''}`}
                aria-current={index === step ? 'step' : undefined}
                onClick={() => goTo(index)}
              >
                <span className={styles.stepNumber}>{index + 1}</span>
                <span className={styles.stepLabel}>{label}</span>
              </button>
            </li>
          ))}
        </ol>

        <ToolPanel title={`${step + 1}. ${STEPS[step]}`} hint={STEP_HINTS[step]}>
          {step === 0 && (
            <div className={styles.welcome}>
              <p>
                Buscá un lugar cómodo y, si podés, un momento sin interrupciones. Alcanzan unos diez minutos. Podés
                avanzar a tu ritmo y saltear lo que hoy no tenga sentido para vos.
              </p>
              {savedThisWeek && (
                <p className={styles.notice}>
                  Ya guardaste un cierre esta semana. Si lo hacés de nuevo, vas a reemplazarlo al guardar.
                </p>
              )}
            </div>
          )}

          {step === 1 && <BreathingGuide />}

          {step === 2 && (
            <div className={styles.fields}>
              {draft.moments.map((value, index) => (
                <label key={`moment-${index}`} className={styles.field}>
                  <span className={styles.fieldLabel}>Momento {index + 1}</span>
                  <input
                    type="text"
                    className={styles.input}
                    value={value}
                    maxLength={280}
                    placeholder={MOMENT_PLACEHOLDERS[index]}
                    onChange={(event) => updateListItem('moments', index, event.target.value)}
                  />
                </label>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className={styles.fields}>
              {draft.gratitude.map((value, index) => (
                <label key={`gratitude-${index}`} className={styles.field}>
                  <span className={styles.fieldLabel}>Agradezco…</span>
                  <input
                    type="text"
                    className={styles.input}
                    value={value}
                    maxLength={280}
                    placeholder={GRATITUDE_PLACEHOLDERS[index]}
                    onChange={(event) => updateListItem('gratitude', index, event.target.value)}
                  />
                </label>
              ))}
            </div>
          )}

          {step === 4 && <ReleaseStep />}

          {step === 5 && (
            <div className={styles.fields}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Mi intención para la próxima semana</span>
                <input
                  type="text"
                  className={styles.input}
                  value={draft.intention}
                  maxLength={280}
                  placeholder="Por ejemplo: ir más despacio"
                  onChange={(event) => updateDraft({ intention: event.target.value })}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Un gesto de cuidado para mí</span>
                <input
                  type="text"
                  className={styles.input}
                  value={draft.care}
                  maxLength={280}
                  placeholder="Por ejemplo: una caminata sin el celular"
                  onChange={(event) => updateDraft({ care: event.target.value })}
                />
              </label>
            </div>
          )}

          {step === 6 && (
            <div>
              <ClosureSummary closure={currentClosure} />
              <div className={styles.closeActions}>
                <Button variant="primary" onClick={saveClosure}>
                  {savedThisWeek ? 'Guardar cambios' : 'Guardar mi cierre'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => downloadTextFile(`cierre-semanal-${week.startKey}.txt`, closureAsText(currentClosure))}
                >
                  Descargar (.txt)
                </Button>
                <Button variant="secondary" onClick={startOver}>
                  Empezar de nuevo
                </Button>
              </div>
              <p className={styles.savedNote} aria-live="polite">
                {!savedThisWeek
                  ? ''
                  : store.saveStatus === 'error'
                    ? 'Todavía sin guardar: descargalo para no perderlo.'
                    : `Guardado ${store.mode === 'account' ? 'en tu cuenta' : 'en este navegador'} · ${new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(savedThisWeek.savedAt))}`}
              </p>
            </div>
          )}

          <div className={styles.nav}>
            <Button variant="secondary" onClick={() => goTo(step - 1)} disabled={step === 0}>
              Anterior
            </Button>
            {step < LAST_STEP && (
              <Button variant="primary" onClick={() => goTo(step + 1)}>
                {step === 0 ? 'Empezar' : 'Siguiente'}
              </Button>
            )}
          </div>
        </ToolPanel>
      </div>

      <ToolPanel
        tone="plain"
        title="Tus cierres anteriores"
        hint={
          closures.length === 0
            ? 'Cuando guardes tu primer cierre, lo vas a encontrar acá.'
            : 'Mirar varias semanas juntas ayuda a ver los ciclos.'
        }
        actions={
          closures.length > 0 && (
            <Button
              variant="secondary"
              onClick={() =>
                downloadTextFile(`cierres-semanales-${localDateKey(new Date())}.txt`, closuresAsText(closures))
              }
            >
              Descargar todos (.txt)
            </Button>
          )
        }
      >
        {closures.length > 0 && (
          <ul className={styles.closures}>
            {closures.map((closure) => (
              <li key={closure.weekKey} className={styles.closureItem}>
                <details>
                  <summary className={styles.closureSummary}>
                    <span>{closure.weekLabel}</span>
                    {closure.intention.trim() && <span className={styles.closureIntention}>{closure.intention}</span>}
                  </summary>
                  <div className={styles.closureBody}>
                    <ClosureSummary closure={closure} compact />
                    <Button variant="secondary" onClick={() => setPendingDelete(closure.weekKey)}>
                      Borrar este cierre
                    </Button>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </ToolPanel>

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="¿Borrar este cierre?"
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
        <p>Se va a borrar de este navegador y no se puede deshacer.</p>
      </Dialog>
    </ToolLayout>
  );
}

const STEP_HINTS = [
  'Antes de empezar, date permiso para frenar.',
  'Unas respiraciones lentas para llegar al cuerpo.',
  '¿Qué momentos de esta semana querés recordar? Grandes o pequeños.',
  'Tres cosas, personas o instantes por los que sentís gratitud.',
  'Escribí lo que querés dejar ir. Esto no se guarda: es solo para soltarlo.',
  'Elegí con qué intención querés empezar la semana que viene.',
  'Así queda tu semana. Podés guardarla, descargarla o simplemente leerla.',
];

const MOMENT_PLACEHOLDERS = ['Una charla, un paseo, una comida…', 'Algo que me hizo reír', 'Algo que me desafió'];
const GRATITUDE_PLACEHOLDERS = ['Una persona', 'Un momento', 'Algo de mí'];

/** Step 5: write what you want to let go of, then watch it fade away. Never stored. */
function ReleaseStep() {
  const [text, setText] = useState('');
  const [releasing, setReleasing] = useState(false);
  const [released, setReleased] = useState(false);

  useEffect(() => {
    if (!releasing) return;
    const timeout = window.setTimeout(() => {
      setText('');
      setReleasing(false);
      setReleased(true);
    }, 2200);
    return () => window.clearTimeout(timeout);
  }, [releasing]);

  return (
    <div className={styles.release}>
      <label htmlFor="release-text" className="sr-only">
        Lo que quiero soltar
      </label>
      <textarea
        id="release-text"
        className={`${styles.releaseText} ${releasing ? styles.releasing : ''}`}
        rows={5}
        value={text}
        readOnly={releasing}
        placeholder="Hoy suelto…"
        onChange={(event) => {
          setText(event.target.value);
          setReleased(false);
        }}
      />
      <div className={styles.releaseFooter}>
        <span className={styles.savedNote} aria-live="polite">
          {released ? 'Listo. Lo que soltaste no quedó guardado en ningún lado.' : ''}
        </span>
        <Button variant="secondary" onClick={() => setReleasing(true)} disabled={!text.trim() || releasing}>
          Soltar
        </Button>
      </div>
    </div>
  );
}

function ClosureSummary({ closure, compact = false }: { closure: Closure; compact?: boolean }) {
  const moments = filled(closure.moments);
  const gratitude = filled(closure.gratitude);
  const empty = !moments.length && !gratitude.length && !closure.intention.trim() && !closure.care.trim();

  if (empty) {
    return <p className={styles.summaryEmpty}>Todavía no escribiste nada en este cierre. Está bien así también.</p>;
  }

  return (
    <div className={compact ? styles.summaryCompact : styles.summary}>
      {moments.length > 0 && (
        <div className={styles.summaryBlock}>
          <p className={styles.summaryLabel}>Momentos de la semana</p>
          <ul className={styles.summaryList}>
            {moments.map((moment, index) => (
              <li key={`${index}-${moment}`}>{moment}</li>
            ))}
          </ul>
        </div>
      )}
      {gratitude.length > 0 && (
        <div className={styles.summaryBlock}>
          <p className={styles.summaryLabel}>Agradezco</p>
          <ul className={styles.summaryList}>
            {gratitude.map((item, index) => (
              <li key={`${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {closure.intention.trim() && (
        <div className={styles.summaryBlock}>
          <p className={styles.summaryLabel}>Intención</p>
          <p className={styles.summaryIntention}>{closure.intention.trim()}</p>
        </div>
      )}
      {closure.care.trim() && (
        <div className={styles.summaryBlock}>
          <p className={styles.summaryLabel}>Un gesto de cuidado</p>
          <p className={styles.summaryText}>{closure.care.trim()}</p>
        </div>
      )}
    </div>
  );
}
