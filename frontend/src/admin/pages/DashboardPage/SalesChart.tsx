import styles from './DashboardPage.module.css';

export interface ChartBar {
  label: string;
  count: number;
}

interface SalesChartProps {
  title: string;
  bars: ChartBar[];
}

/** The period's sales as a simple CSS bar chart (no charting library needed at this scale). */
export function SalesChart({ title, bars }: SalesChartProps) {
  const max = Math.max(1, ...bars.map((bar) => bar.count));

  return (
    <div className={[styles.panel, styles.panelInner].join(' ')}>
      <h2 className={styles.panelTitle}>{title}</h2>
      <div className={styles.chart}>
        {bars.map((bar, index) => (
          <div key={`${bar.label}-${index}`} className={styles.chartCol}>
            <div
              className={[styles.chartBar, bar.count === 0 ? styles.chartBarEmpty : styles.chartBarFilled].join(' ')}
              style={{ height: bar.count === 0 ? '3px' : `${(bar.count / max) * 100}%` }}
            />
            <span className={styles.chartLabel}>{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
