import { useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './Reveal.module.css';

/**
 * Fades its content in, very gently, the first time it scrolls into view.
 * One IntersectionObserver per instance, disconnected after it fires; only
 * opacity and transform change, so the browser can animate it on the
 * compositor. With `prefers-reduced-motion` (or no IntersectionObserver)
 * the content is simply shown.
 */
export function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = ref.current;
    if (!element || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className={`${styles.reveal} ${visible ? styles.visible : ''}`}>
      {children}
    </div>
  );
}
