import { useEffect, useState, type CSSProperties } from 'react';
import { Button } from '../../../shared/components/Button/Button';
import styles from './BreathingGuide.module.css';

const PHASES = [
  { label: 'Inhalá', seconds: 4, size: 'large' },
  { label: 'Sostené', seconds: 2, size: 'large' },
  { label: 'Exhalá', seconds: 6, size: 'small' },
] as const;

const CYCLES = 4;

/**
 * A slow 4–2–6 breathing guide: a circle that grows and shrinks with the
 * breath, about one minute in total. Under `prefers-reduced-motion` the
 * circle stays still and only the words change.
 */
export function BreathingGuide() {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!running) return;
    const timeout = window.setTimeout(() => {
      if (phase < PHASES.length - 1) {
        setPhase(phase + 1);
      } else if (cycle < CYCLES - 1) {
        setPhase(0);
        setCycle(cycle + 1);
      } else {
        setRunning(false);
        setDone(true);
      }
    }, PHASES[phase].seconds * 1000);
    return () => window.clearTimeout(timeout);
  }, [running, phase, cycle]);

  const start = () => {
    setPhase(0);
    setCycle(0);
    setDone(false);
    setRunning(true);
  };

  const current = PHASES[phase];
  const expanded = running && current.size === 'large';

  return (
    <div className={styles.guide}>
      <div className={styles.stage} aria-hidden="true">
        <div
          className={`${styles.circle} ${expanded ? styles.expanded : ''}`}
          style={{ '--breath-duration': `${current.seconds}s` } as CSSProperties}
        />
        <span className={styles.word}>{running ? current.label : done ? 'Listo' : 'Respirá'}</span>
      </div>

      <p className={styles.status} aria-live="polite">
        {running
          ? `${current.label} · respiración ${cycle + 1} de ${CYCLES}`
          : done
            ? 'Muy bien. Cuando quieras, seguimos.'
            : 'Cuatro respiraciones lentas: inhalá en 4, sostené en 2 y exhalá en 6.'}
      </p>

      {running ? (
        <Button variant="secondary" onClick={() => setRunning(false)}>
          Detener
        </Button>
      ) : (
        <Button variant="secondary" onClick={start}>
          {done ? 'Repetir' : 'Comenzar a respirar'}
        </Button>
      )}
    </div>
  );
}
