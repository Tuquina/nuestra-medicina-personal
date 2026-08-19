import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../BrandMark/BrandMark';
import styles from './SiteHeader.module.css';

const NAV_LINKS = [
  { label: 'Inicio', to: '/' },
  { label: 'Libros', to: '/libros' },
  { label: 'Meditaciones', to: '/meditaciones' },
  { label: 'Herramientas', to: '/herramientas' },
];

/**
 * Full site navigation header: sticky, gains a shadow past a small scroll
 * threshold, collapses to a hamburger menu below ~1040px. Used on every
 * public page except Login (which uses the bare `PublicHeader` on
 * purpose — see its doc comment).
 */
export function SiteHeader() {
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
            <Link key={link.to} to={link.to}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.authRow}>
          <Link to="/biblioteca" className={styles.libraryLink}>
            Mi biblioteca
          </Link>
          <Link to="/login" className={styles.loginButton}>
            Iniciar sesión
          </Link>
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
          <Link key={link.to} to={link.to} onClick={closeMenu}>
            {link.label}
          </Link>
        ))}
        <Link to="/biblioteca" className={styles.libraryLink} onClick={closeMenu}>
          Mi biblioteca
        </Link>
        <Link to="/login" className={styles.loginButton} onClick={closeMenu}>
          Iniciar sesión
        </Link>
      </nav>
    </header>
  );
}
