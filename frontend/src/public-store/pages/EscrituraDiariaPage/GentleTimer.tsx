import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '../../../shared/components/Button/Button';
import { ChoiceChips } from '../../components/ChoiceChips/ChoiceChips';
import styles from './GentleTimer.module.css';

const DURATIONS = [
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
] as const;

type DurationValue = (typeof DURATIONS)[number]['value'];

/**
 * An optional, silent writing timer. No alarms: when time is up it just
 * says so, and the visitor can keep writing.
 */
export function GentleTimer() {
  const [minutes, setMinutes] = useState<DurationValue>('10');
  const [remaining, setRemaining] = useState(10 * 60);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const endAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const endAt = endAtRef.current ?? Date.now();
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        setFinished(true);
      }
    };
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [running]);

  const total = Number(minutes) * 60;

  const chooseDuration = (value: DurationValue | null) => {
    if (!value || running) return;
    setMinutes(value);
    setRemaining(Number(value) * 60);
    setFinished(false);
  };

  const start = () => {
    endAtRef.current = Date.now() + remaining * 1000;
    setFinished(false);
    setRunning(true);
  };

  const pause = () => setRunning(false);

  const reset = () => {
    setRunning(false);
    setFinished(false);
    setRemaining(total);
  };

  const progress = total > 0 ? 1 - remaining / total : 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div className={styles.timer}>
      <div className={styles.row}>
        <span className={styles.label}>Tiempo de escritura (opcional)</span>
        <ChoiceChips label="Duración del temporizador" options={DURATIONS} value={minutes} onChange={chooseDuration} />
      </div>

      <div className={styles.row}>
        <span className={styles.clock} aria-label={`Quedan ${mm} minutos y ${ss} segundos`}>
          {mm}:{ss}
        </span>
        <div className={styles.controls}>
          {running ? (
            <Button variant="secondary" onClick={pause}>
              Pausar
            </Button>
          ) : (
            <Button variant="secondary" onClick={start} disabled={remaining === 0}>
              {remaining < total && remaining > 0 ? 'Seguir' : 'Empezar'}
            </Button>
          )}
          {(remaining < total || finished) && (
            <Button variant="secondary" onClick={reset}>
              Reiniciar
            </Button>
          )}
        </div>
      </div>

      <div className={styles.track} aria-hidden="true">
        <div className={styles.fill} style={{ '--progress': progress } as CSSProperties} />
      </div>

      <p className={styles.message} aria-live="polite">
        {finished ? 'Terminó tu tiempo. Si querés, podés seguir escribiendo.' : ''}
      </p>
    </div>
  );
}
