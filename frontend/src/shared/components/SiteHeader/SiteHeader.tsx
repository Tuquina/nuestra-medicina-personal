import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { BrandMark } from '../BrandMark/BrandMark';
import { useAuth } from '../../auth/useAuth';
import { initialsFrom } from '../../auth/types';
import styles from './SiteHeader.module.css';

const NAV_LINKS = [
  { label: 'Inicio', to: '/', end: true },
  { label: 'Libros', to: '/libros', end: false },
  { label: 'Meditaciones', to: '/meditaciones', end: false },
  { label: 'Herramientas', to: '/herramientas', end: false },
];

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  isActive ? styles.navActive : undefined;

const libraryLinkClassName = ({ isActive }: { isActive: boolean }) =>
  [styles.libraryLink, isActive ? styles.libraryActive : ''].filter(Boolean).join(' ');

/**
 * Full site navigation header: sticky, gains a shadow past a small scroll
 * threshold, collapses to a hamburger menu below ~1040px, and highlights
 * the current section (e.g. "Libros" on `/libros`). Used on every public
 * page except Login (which uses the bare `PublicHeader` on purpose — see
 * its doc comment).
 *
 * Reads the signed-in state from `useAuth()` directly (see
 * `shared/auth`) rather than taking a prop — every page that renders
 * this gets the real avatar/"Iniciar sesión" state automatically, based
 * on the session cookie, not on whether that particular page remembered
 * to pass one.
 */
export function SiteHeader() {
  const auth = useAuth();
  const user = auth.status === 'authenticated' ? auth.user : null;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={styles.header}>
      <div className={[styles.row, scrolled ? styles.scrolled : ''].join(' ')}>
        <Link to="/" className={styles.logo}>
          <BrandMark />
          Nuestra Medicina Personal
        </Link>

        <nav className={styles.nav} aria-label="Principal">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={navLinkClassName}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.authRow}>
          <NavLink to="/biblioteca" className={libraryLinkClassName}>
            Mi biblioteca
          </NavLink>
          {user ? (
            <Link to="/cuenta" className={styles.avatar} aria-label="Mi cuenta">
              {initialsFrom(user.displayName)}
            </Link>
          ) : (
            <Link to="/login" className={styles.loginButton}>
              Iniciar sesión
            </Link>
          )}
        </div>

        <button
          type="button"
          className={styles.menuToggle}
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>
      </div>

      <nav
        className={[styles.mobileMenu, menuOpen ? styles.open : ''].join(' ')}
        aria-label="Principal (móvil)"
      >
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={navLinkClassName}
            onClick={closeMenu}
          >
            {link.label}
          </NavLink>
        ))}
        <NavLink to="/biblioteca" className={libraryLinkClassName} onClick={closeMenu}>
          Mi biblioteca
        </NavLink>
        {user ? (
          <Link to="/cuenta" className={styles.navActive} onClick={closeMenu}>
            Mi cuenta
          </Link>
        ) : (
          <Link to="/login" className={styles.loginButton} onClick={closeMenu}>
            Iniciar sesión
          </Link>
        )}
      </nav>
    </header>
  );
}
