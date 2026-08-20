import { useState } from 'react';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { MinimalFooter } from '../../../shared/components/MinimalFooter/MinimalFooter';
import { Eyebrow } from '../../../shared/components/Eyebrow/Eyebrow';
import { Switch } from '../../../shared/components/Switch/Switch';
import { Button } from '../../../shared/components/Button/Button';
import { Dialog } from '../../../shared/components/Dialog/Dialog';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { useAuth } from '../../../shared/auth/useAuth';
import { initialsFrom } from '../../../shared/auth/types';
import { AuthLoading } from '../../../shared/components/AuthLoading/AuthLoading';
import { LOGOUT_URL } from '../../../shared/config/api';
import { hardNavigate } from '../../../shared/utils/navigation';
import styles from './MiCuentaPage.module.css';

/** `/cuenta` — the signed-in user's account settings. Only ever reached
 * through the `RequireAuth` route guard, so `auth.status` is always
 * `'authenticated'` in practice — the fallback below is just defensive. */
export function MiCuentaPage() {
  useDocumentTitle('Mi cuenta · Nuestra Medicina Personal');
  const auth = useAuth();

  const [newsletterOn, setNewsletterOn] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  if (auth.status !== 'authenticated') return <AuthLoading />;
  const user = auth.user;

  const handleLogout = async () => {
    try {
      await fetch(LOGOUT_URL, { method: 'POST', credentials: 'include' });
    } finally {
      // A full reload, not SPA navigation: AuthProvider only fetches
      // `/api/v1/auth/me` once per app load, so an in-SPA `navigate('/')`
      // would leave the header showing the now-stale signed-in state.
      hardNavigate('/');
    }
  };

  return (
    <div className={styles.page}>
      <GradientTopBar />
      <SiteHeader />

      <main className={styles.main}>
        <div className={styles.eyebrow}>
          <Eyebrow>Tu cuenta</Eyebrow>
        </div>
        <h1 className={styles.title}>Mi cuenta</h1>

        <div className={styles.card}>
          <div className={styles.identity}>
            <span className={styles.avatar}>{initialsFrom(user.displayName)}</span>
            <div>
              <p className={styles.name}>{user.displayName}</p>
              <p className={styles.email}>{user.email}</p>
            </div>
          </div>
          <p className={styles.googleNote}>
            Tu cuenta está vinculada con Google. El nombre y el correo se
            sincronizan automáticamente.
          </p>

          <div className={styles.settingRow}>
            <div>
              <p className={styles.settingLabel}>Recibir novedades por correo</p>
              <p className={styles.settingHint}>Libros, meditaciones y contenidos nuevos.</p>
            </div>
            <Switch
              checked={newsletterOn}
              onChange={setNewsletterOn}
              label="Recibir novedades por correo"
            />
          </div>
        </div>

        <Button variant="secondary" fullWidth className={styles.logoutButton} onClick={handleLogout}>
          Cerrar sesión
        </Button>

        <div className={styles.deleteRow}>
          <button
            type="button"
            className={styles.deleteLink}
            onClick={() => setShowDelete(true)}
          >
            Eliminar mi cuenta
          </button>
        </div>
      </main>

      <Dialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title="¿Eliminar tu cuenta?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowDelete(false)}>
              Cancelar
            </Button>
            {/* No DELETE /api/v1/me endpoint exists yet (architecture.md
                §34 doesn't define one) — left unwired rather than faked. */}
            <Button variant="danger">Eliminar</Button>
          </>
        }
      >
        Esta acción no se puede deshacer. Vas a perder el acceso a tu
        biblioteca y a tus libros comprados.
      </Dialog>

      <MinimalFooter />
    </div>
  );
}
