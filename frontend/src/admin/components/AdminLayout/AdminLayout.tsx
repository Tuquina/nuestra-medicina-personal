import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { BrandMark } from '../../../shared/components/BrandMark/BrandMark';
import styles from './AdminLayout.module.css';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [styles.navLink, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ');

const navLinkClassSpaced = ({ isActive }: { isActive: boolean }) =>
  [styles.navLink, styles.navLinkSpaced, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ');

interface AdminLayoutProps {
  title: string;
  /** Replaces the default `<h1>{title}</h1>` — for pages like the book
   * editor that need a back-link above the title instead of a plain
   * string. `title` is still used for the document title/fallback. */
  titleSlot?: ReactNode;
  headerActions?: ReactNode;
  /** The book editor's header has no avatar — save status + actions fill that space instead. */
  hideAvatar?: boolean;
  children: ReactNode;
}

/**
 * The sidebar + header shell every `/admin/*` page renders inside.
 * Sidebar nav matches every Admin *.dc.html mockup's identical `<aside>`
 * — including that "Inicio" and "Páginas de libros" both point at the
 * one Page Builder route today (that's what the mockups themselves do;
 * see docs/frontend-plan.md for the Page Builder's own route once it
 * needs to distinguish which page it's editing).
 */
export function AdminLayout({ title, titleSlot, headerActions, hideAvatar = false, children }: AdminLayoutProps) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link to="/admin" className={styles.logo}>
          <BrandMark />
          <span className={styles.logoText}>Nuestra Medicina Personal</span>
        </Link>

        <nav className={styles.nav} aria-label="Admin">
          <NavLink to="/admin" end className={navLinkClass}>
            Dashboard
          </NavLink>

          <p className={styles.sectionLabel}>Libros</p>
          <NavLink to="/admin/libros" end className={navLinkClass}>
            Todos los libros
          </NavLink>
          <NavLink to="/admin/libros/nuevo" className={navLinkClass}>
            Nuevo libro
          </NavLink>

          <p className={styles.sectionLabel}>Páginas</p>
          <NavLink to="/admin/paginas" end className={navLinkClass}>
            Inicio
          </NavLink>
          <NavLink to="/admin/paginas" end className={navLinkClass}>
            Páginas de libros
          </NavLink>
          <NavLink to="/admin/sobre-el-proyecto" className={navLinkClass}>
            Sobre el proyecto
          </NavLink>
          <NavLink to="/admin/paginas/meditaciones" className={navLinkClass}>
            Meditaciones
          </NavLink>
          <NavLink to="/admin/paginas/herramientas" className={navLinkClass}>
            Herramientas
          </NavLink>

          <NavLink to="/admin/ventas" className={navLinkClassSpaced}>
            Ventas
          </NavLink>
          <NavLink to="/admin/clientes" className={navLinkClass}>
            Clientes
          </NavLink>
          <NavLink to="/admin/cupones" className={navLinkClass}>
            Cupones
          </NavLink>
          <NavLink to="/admin/resenas" className={navLinkClass}>
            Reseñas
          </NavLink>
          <NavLink to="/admin/analitica" className={navLinkClass}>
            Analítica
          </NavLink>
          <NavLink to="/admin/multimedia" className={navLinkClass}>
            Multimedia
          </NavLink>
          <NavLink to="/admin/configuracion" className={navLinkClass}>
            Configuración
          </NavLink>

          <p className={styles.sectionLabel}>Ayuda</p>
          <NavLink to="/admin/ayuda/contacto" className={navLinkClass}>
            Contacto
          </NavLink>
          <NavLink to="/admin/ayuda/soporte" className={navLinkClass}>
            Soporte
          </NavLink>
          <NavLink to="/admin/ayuda/preguntas-frecuentes" className={navLinkClass}>
            Preguntas frecuentes
          </NavLink>

          <p className={styles.sectionLabel}>Legal</p>
          <NavLink to="/admin/legal/terminos" className={navLinkClass}>
            Términos
          </NavLink>
          <NavLink to="/admin/legal/privacidad" className={navLinkClass}>
            Privacidad
          </NavLink>
        </nav>

        <Link to="/" className={styles.siteLink}>
          Ver sitio →
        </Link>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          {titleSlot ?? <h1 className={styles.title}>{title}</h1>}
          <div className={styles.headerRight}>
            {headerActions}
            {!hideAvatar && <span className={styles.avatar}>AD</span>}
          </div>
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
