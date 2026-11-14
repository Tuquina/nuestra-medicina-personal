import { Link } from 'react-router-dom';
import { BrandMark } from '../BrandMark/BrandMark';
import { useSiteSettings } from '../../site/siteSettings';
import styles from './SiteFooter.module.css';


const EXPLORE_LINKS = [
  { label: 'Inicio', to: '/' },
  { label: 'Libros', to: '/libros' },
  { label: 'Meditaciones', to: '/meditaciones' },
  { label: 'Herramientas', to: '/herramientas' },
];

const HELP_LINKS = [
  { label: 'Contacto', to: '/contacto' },
  { label: 'Soporte', to: '/soporte' },
  { label: 'Preguntas frecuentes', to: '/preguntas-frecuentes' },
];

const LEGAL_LINKS = [
  { label: 'Términos', to: '/terminos' },
  { label: 'Privacidad', to: '/privacidad' },
];

/**
 * Full site footer: brand blurb, sitemap columns, and the health-content
 * disclaimer required by architecture.md §1.4 ("medicina" in the product
 * name can read as medical — content here is educational/reflective, not
 * a substitute for professional care).
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  const site = useSiteSettings();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          <div>
            <Link to="/" className={styles.brand}>
              <BrandMark />
              {site.siteName}
            </Link>
            <p className={styles.tagline}>
              {site.siteDescription || 'Escritura, reflexión y herramientas para procesos personales y educativos.'}
            </p>
          </div>

          <FooterColumn title="Explorar" links={EXPLORE_LINKS} />
          <FooterColumn title="Ayuda" links={HELP_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>

        <div className={styles.legalBlock}>
          <p className={styles.disclaimer}>
            Los contenidos de Nuestra Medicina Personal tienen fines
            educativos y reflexivos y no sustituyen la atención médica o
            psicológica profesional.
          </p>
          <p className={styles.copyright}>
            © {year} {site.siteName} · <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; to: string }[];
}) {
  return (
    <div>
      <p className={styles.columnTitle}>{title}</p>
      <div className={styles.linkList}>
        {links.map((link) => (
          <Link key={link.to} to={link.to}>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
