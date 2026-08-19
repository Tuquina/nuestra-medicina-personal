import type { ReactNode } from 'react';
import type { StatusTone } from '../../utils/statusTone';
import styles from './StatusBadge.module.css';

interface StatusBadgeProps {
  tone: StatusTone;
  children: ReactNode;
}

/** A small pill for order/payment/publication status — used across admin tables. */
export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return <span className={[styles.badge, styles[tone]].join(' ')}>{children}</span>;
}
