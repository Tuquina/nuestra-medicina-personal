import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { MinimalFooter } from '../../../shared/components/MinimalFooter/MinimalFooter';
import { BackLink } from '../../../shared/components/BackLink/BackLink';
import { Eyebrow } from '../../../shared/components/Eyebrow/Eyebrow';
import { Button } from '../../../shared/components/Button/Button';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useAuth } from '../../../shared/auth/useAuth';
import { TOOL_OPTIONS, toolPath, type ToolSlug } from '../../../shared/cms/collectionContent';
import type { ToolEntriesStore } from '../../hooks/useToolEntries';
import { ToolIllustration } from '../ToolIllustration/ToolIllustration';
import styles from './ToolLayout.module.css';

interface ToolLayoutProps {
  tool: ToolSlug;
  title: string;
  intro: string;
  /** Where the tool keeps its entries (account or this browser) and how saving is going. */
  store: ToolEntriesStore;
  children: ReactNode;
}

/**
 * Shared shell for every Herramientas tool page: hero with the tool's
 * illustration, a privacy note that says where the writing is kept, the
 * tool itself (only once its entries are loaded), a gentle care note and
 * links to the other tools.
 */
export function ToolLayout({ tool, title, intro, store, children }: ToolLayoutProps) {
  useDocumentTitle(`${title} · Herramientas · Nuestra Medicina Personal`);
  const auth = useAuth();
  const [importDismissed, setImportDismissed] = useState(false);
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
            <PrivacyText mode={store.mode} signedIn={auth.status === 'authenticated'} />
          </p>
        </div>
        <div className={styles.heroArt}>
          <ToolIllustration tool={tool} />
        </div>
      </header>

      <main className={styles.main}>
        {store.mode === 'loading' ? (
          <p className={styles.loading} role="status">
            Cargando lo que escribiste…
          </p>
        ) : store.loadError ? (
          <div className={styles.unsaved} role="alert">
            <p>No pudimos cargar lo que tenés guardado en tu cuenta. Revisá tu conexión e intentá de nuevo.</p>
            <Button variant="secondary" onClick={store.retryLoad}>
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            {store.mode === 'account' && store.deviceEntryCount > 0 && !importDismissed && (
              <div className={styles.notice} role="status">
                <p>
                  Tenés {store.deviceEntryCount} {store.deviceEntryCount === 1 ? 'registro guardado' : 'registros guardados'}{' '}
                  solo en este navegador. ¿Querés pasarlos a tu cuenta, cifrados?
                </p>
                <div className={styles.noticeActions}>
                  <Button variant="primary" onClick={() => void store.importDeviceEntries()} disabled={store.importing}>
                    {store.importing ? 'Pasando…' : 'Pasar a mi cuenta'}
                  </Button>
                  <Button variant="secondary" onClick={() => setImportDismissed(true)} disabled={store.importing}>
                    Ahora no
                  </Button>
                </div>
              </div>
            )}
            {store.saveStatus === 'error' && (
              <p className={styles.unsaved} role="alert">
                {store.mode === 'account'
                  ? 'No pudimos guardar tus últimos cambios en tu cuenta. Volvemos a intentar en unos segundos; no cierres la página todavía.'
                  : 'Este navegador no nos deja guardar (puede estar en modo privado, con los datos del sitio bloqueados o sin espacio). Lo que escribas se va a perder al cerrar la página: descargalo antes de irte.'}
              </p>
            )}
            {children}
          </>
        )}
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

function PrivacyText({ mode, signedIn }: { mode: ToolEntriesStore['mode']; signedIn: boolean }) {
  if (mode === 'account') {
    return (
      <span>
        Lo que escribís se guarda cifrado en tu cuenta y solo vos podés leerlo: nadie más tiene acceso, tampoco la
        administración del sitio.
      </span>
    );
  }
  if (signedIn) {
    return <span>Por ahora lo que escribís se guarda solo en este navegador. No se envía a ningún servidor.</span>;
  }
  return (
    <span>
      Lo que escribís se guarda solo en este navegador. <Link to="/login">Iniciá sesión</Link> para guardarlo cifrado en
      tu cuenta y verlo desde cualquier dispositivo.
    </span>
  );
}
