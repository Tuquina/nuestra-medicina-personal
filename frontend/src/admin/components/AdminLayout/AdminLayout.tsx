import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { BrandMark } from '../../../shared/components/BrandMark/BrandMark';
import styles from './AdminLayout.module.css';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [styles.navLink, isActive ? styles.navLinkActive : ''].filter(Boolean).join(' ');

interface NavItem {
  to: string;
  label: string;
  /** Match only this exact path (otherwise sub-pages, e.g. an editor, keep it highlighted). */
  end?: boolean;
}

interface NavSection {
  label: string;
  /** Short hint shown next to the label, e.g. that a section only shows data. */
  hint?: string;
  items: NavItem[];
}

/**
 * Sidebar sections, grouped by what the admin does there: content she
 * creates, pages of the site she edits, the store she manages, reports she
 * only reads, and settings. "Nuevo libro" / "Nueva meditación" live as
 * buttons on each list instead of separate menu entries.
 */
const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Contenido',
    items: [
      { to: '/admin/libros', label: 'Libros' },
      { to: '/admin/meditaciones', label: 'Meditaciones' },
      { to: '/admin/multimedia', label: 'Imágenes (Multimedia)' },
    ],
  },
  {
    label: 'Páginas del sitio',
    items: [
      { to: '/admin/paginas', label: 'Inicio', end: true },
      { to: '/admin/sobre-el-proyecto', label: 'Sobre el proyecto' },
      { to: '/admin/paginas/meditaciones', label: 'Portada de Meditaciones' },
      { to: '/admin/paginas/herramientas', label: 'Portada de Herramientas' },
    ],
  },
  {
    label: 'Ayuda y legales',
    items: [
      { to: '/admin/ayuda/contacto', label: 'Contacto' },
      { to: '/admin/ayuda/soporte', label: 'Soporte' },
      { to: '/admin/ayuda/preguntas-frecuentes', label: 'Preguntas frecuentes' },
      { to: '/admin/legal/terminos', label: 'Términos y condiciones' },
      { to: '/admin/legal/privacidad', label: 'Privacidad' },
    ],
  },
  {
    label: 'Tienda',
    items: [
      { to: '/admin/cupones', label: 'Cupones' },
      { to: '/admin/resenas', label: 'Reseñas' },
    ],
  },
  {
    label: 'Informes',
    hint: 'solo lectura',
    items: [
      { to: '/admin/ventas', label: 'Ventas' },
      { to: '/admin/clientes', label: 'Clientes' },
      { to: '/admin/analitica', label: 'Analítica' },
    ],
  },
  {
    label: 'Ajustes',
    items: [{ to: '/admin/configuracion', label: 'Configuración' }],
  },
];

interface AdminLayoutProps {
  title: string;
  /** Replaces the default `<h1>{title}</h1>` — for pages like the book
   * editor that need a back-link above the title instead of a plain
   * string. `title` is still used for the document title/fallback. */
  titleSlot?: ReactNode;
  headerActions?: ReactNode;
  /** Marks a page that only shows data (reports), so nothing there looks editable. */
  readOnly?: boolean;
  /** The book editor's header has no avatar — save status + actions fill that space instead. */
  hideAvatar?: boolean;
  children: ReactNode;
}

/**
 * The sidebar + header shell every `/admin/*` page renders inside.
 * Sidebar sections come from `NAV_SECTIONS` above (content, site pages,
 * store, read-only reports, settings). Each book's sales page is edited
 * from that book's editor ("Página de venta" tab), not from a separate
 * menu entry.
 *
 * Below ~900px the sidebar becomes an off-canvas drawer (hamburger
 * button in the header, backdrop to dismiss) instead of the fixed
 * always-visible column — a fixed 240px sidebar plus a 240px content
 * margin doesn't fit in a 375px-wide phone viewport at all. `menuOpen`
 * naturally resets to closed on every navigation since each admin page
 * mounts its own `<AdminLayout>` instance.
 */
export function AdminLayout({ title, titleSlot, headerActions, readOnly = false, hideAvatar = false, children }: AdminLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.shell}>
      {menuOpen && (
        <div className={styles.backdrop} onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}
      <aside className={[styles.sidebar, menuOpen ? styles.sidebarOpen : ''].join(' ')}>
        <Link to="/admin" className={styles.logo}>
          <BrandMark />
          <span className={styles.logoText}>Nuestra Medicina Personal</span>
        </Link>

        <nav className={styles.nav} aria-label="Admin">
          <NavLink to="/admin" end className={navLinkClass}>
            Resumen
          </NavLink>

          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className={styles.section}>
              <p className={styles.sectionLabel}>
                {section.label}{section.hint && ' '}
                {section.hint && <span className={styles.sectionHint}>{section.hint}</span>}
              </p>
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <Link to="/" className={styles.siteLink}>
          Ver sitio →
        </Link>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              type="button"
              className={styles.menuButton}
              aria-label="Abrir menú"
              onClick={() => setMenuOpen(true)}
            >
              ☰
            </button>
            {titleSlot ?? <h1 className={styles.title}>{title}</h1>}
            {readOnly && (
              <span className={styles.readOnlyBadge} title="Esta sección sólo muestra información; no se edita nada desde acá.">
                Solo lectura
              </span>
            )}
          </div>
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
