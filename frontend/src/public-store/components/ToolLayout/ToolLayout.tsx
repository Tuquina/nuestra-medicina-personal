import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { MinimalFooter } from '../../../shared/components/MinimalFooter/MinimalFooter';
import { BackLink } from '../../../shared/components/BackLink/BackLink';
import { Eyebrow } from '../../../shared/components/Eyebrow/Eyebrow';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { TOOL_OPTIONS, toolPath, type ToolSlug } from '../../../shared/cms/collectionContent';
import { ToolIllustration } from '../ToolIllustration/ToolIllustration';
import styles from './ToolLayout.module.css';

interface ToolLayoutProps {
  tool: ToolSlug;
  title: string;
  intro: string;
  /** False when the browser refuses to store data: shows an "unsaved" warning. */
  persisted?: boolean;
  children: ReactNode;
}

/**
 * Shared shell for every Herramientas tool page: hero with the tool's
 * illustration, a privacy note (everything stays in this browser), the
 * tool itself, a gentle care note and links to the other tools.
 */
export function ToolLayout({ tool, title, intro, persisted = true, children }: ToolLayoutProps) {
  useDocumentTitle(`${title} · Herramientas · Nuestra Medicina Personal`);
  const otherTools = TOOL_OPTIONS.filter((option) => option.slug !== tool);

  return (
    <div className={styles.page}>
      <GradientTopBar />
      <SiteHeader />
      <BackLink to="/herramientas">Volver a Herramientas</BackLink>

      <header className={styles.hero}>
        <div className={styles.heroText}>
          <Eyebrow>Herramienta</Eyebrow>
          <h1 className={`${styles.title} gradient-text`}>{title}</h1>
          <p className={styles.intro}>{intro}</p>
          <p className={styles.privacy}>
            <LockIcon />
            <span>
              Lo que escribís se guarda solo en este navegador. No se envía a ningún servidor y nadie más puede leerlo.
            </span>
          </p>
        </div>
        <div className={styles.heroArt}>
          <ToolIllustration tool={tool} />
        </div>
      </header>

      <main className={styles.main}>
        {!persisted && (
          <p className={styles.unsaved} role="alert">
            Este navegador no nos deja guardar (puede estar en modo privado, con los datos del sitio bloqueados o sin
            espacio). Lo que escribas se va a perder al cerrar la página: descargalo antes de irte.
          </p>
        )}
        {children}
      </main>

      <aside className={styles.care} aria-label="Una nota de cuidado">
        <p>
          Estas herramientas acompañan, pero no reemplazan un espacio terapéutico. Si estás atravesando un momento
          difícil, no tenés que hacerlo en soledad: buscá a alguien de confianza o a un profesional de la salud.
        </p>
      </aside>

      <nav className={styles.others} aria-label="Otras herramientas">
        <p className={styles.othersTitle}>Otras herramientas</p>
        <ul className={styles.othersList}>
          {otherTools.map((option) => (
            <li key={option.slug}>
              <Link to={toolPath(option.slug)} className={styles.otherLink}>
                <span className={styles.otherThumb}>
                  <ToolIllustration tool={option.slug} />
                </span>
                {option.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <MinimalFooter />
    </div>
  );
}

function LockIcon() {
  return (
    <svg className={styles.lockIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="3" y="7" width="10" height="7" rx="2" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}
