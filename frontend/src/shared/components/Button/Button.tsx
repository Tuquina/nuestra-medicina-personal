import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'danger' | 'accent';

interface SharedProps {
  variant?: Variant;
  fullWidth?: boolean;
  className?: string;
}

type ButtonAsButton = SharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & { to?: undefined; href?: undefined };

type ButtonAsLink = SharedProps & Omit<LinkProps, 'className'> & { href?: undefined };

type ButtonAsAnchor = SharedProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> & { to?: undefined };

type ButtonProps = ButtonAsButton | ButtonAsLink | ButtonAsAnchor;

/**
 * Shared button styling — primary/secondary/danger/accent. Renders a
 * `<button>` by default; pass `to` (internal route) or `href` (external
 * URL) to render the same look as a `Link`/`<a>` instead, so a
 * button-styled navigation never ends up as a `<button>` nested inside
 * an `<a>` (invalid HTML — react-router's `Link` already renders one).
 */
export function Button({ variant = 'primary', fullWidth = false, className, ...rest }: ButtonProps) {
  const classes = [styles.button, styles[variant], fullWidth ? styles.fullWidth : '', className]
    .filter(Boolean)
    .join(' ');

  if ('to' in rest && rest.to !== undefined) {
    const { to, ...linkRest } = rest;
    return <Link to={to} className={classes} {...linkRest} />;
  }

  if ('href' in rest && rest.href !== undefined) {
    const { href, ...anchorRest } = rest;
    return <a href={href} className={classes} {...anchorRest} />;
  }

  const { type = 'button', ...buttonRest } = rest as ButtonAsButton;
  return <button type={type} className={classes} {...buttonRest} />;
}
