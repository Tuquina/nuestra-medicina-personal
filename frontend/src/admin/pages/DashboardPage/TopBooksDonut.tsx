import type { CSSProperties } from 'react';
import styles from './DashboardPage.module.css';

const SLICE_COLORS = ['var(--color-accent-gold)', 'var(--color-deep-blue)', 'var(--color-sky)'];

export interface DonutSlice {
  slug: string;
  title: string;
  count: number;
  pct: number;
}

interface TopBooksDonutProps {
  title: string;
  slices: DonutSlice[];
  total: number;
}

/** Book-breakdown donut, built with a single conic-gradient — no charting library. */
export function TopBooksDonut({ title, slices, total }: TopBooksDonutProps) {
  let cursor = 0;
  const stops = slices.map((slice, index) => {
    const color = SLICE_COLORS[index % SLICE_COLORS.length];
    const start = cursor;
    cursor += slice.pct;
    return `${color} ${start}% ${cursor}%`;
  });

  const donutStyle: CSSProperties = {
    background: total === 0 ? 'oklch(93% 0.006 90)' : `conic-gradient(${stops.join(', ')})`,
  };

  return (
    <div className={[styles.panel, styles.panelInner].join(' ')}>
      <h2 className={styles.panelTitle}>{title}</h2>
      <div className={styles.donutRow}>
        <div className={styles.donut} style={donutStyle}>
          <div className={styles.donutHole}>
            <span className={styles.donutTotal}>{total}</span>
            <span className={styles.donutTotalLabel}>ventas</span>
          </div>
        </div>
        <div className={styles.donutLegend}>
          {slices.map((slice, index) => (
            <div key={slice.slug} className={styles.legendRow}>
              <span
                className={styles.legendDot}
                style={{
                  background: SLICE_COLORS[index % SLICE_COLORS.length],
                }}
              />
              <span className={styles.legendLabel}>{slice.title}</span>
              <span className={styles.legendValue}>{slice.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
