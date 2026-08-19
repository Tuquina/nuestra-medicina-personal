import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GradientTopBar } from '../../../shared/components/GradientTopBar/GradientTopBar';
import { SiteHeader } from '../../../shared/components/SiteHeader/SiteHeader';
import { MinimalFooter } from '../../../shared/components/MinimalFooter/MinimalFooter';
import { Eyebrow } from '../../../shared/components/Eyebrow/Eyebrow';
import { Switch } from '../../../shared/components/Switch/Switch';
import { Button } from '../../../shared/components/Button/Button';
import { Dialog } from '../../../shared/components/Dialog/Dialog';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { CURRENT_USER } from '../../data/currentUser';
import { LOGOUT_URL } from '../../../shared/config/api';
import styles from './MiCuentaPage.module.css';

/** `/cuenta` — the signed-in user's account settings. */
export function MiCuentaPage() {
  useDocumentTitle('Mi cuenta · Nuestra Medicina Personal');
  const navigate = useNavigate();

  const [newsletterOn, setNewsletterOn] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch(LOGOUT_URL, { method: 'POST' });
    } catch {
      // No backend yet — this 404s locally; the session-clearing intent
      // is still correct once it exists (architecture.md §20).
    } finally {
      navigate('/');
    }
  };

  return (
    <div className={styles.page}>
      <GradientTopBar />
      <SiteHeader user={CURRENT_USER} />

      <main className={styles.main}>
        <div className={styles.eyebrow}>
          <Eyebrow>Tu cuenta</Eyebrow>
        </div>
        <h1 className={styles.title}>Mi cuenta</h1>

        <div className={styles.card}>
          <div className={styles.identity}>
            <span className={styles.avatar}>{CURRENT_USER.initials}</span>
            <div>
              <p className={styles.name}>{CURRENT_USER.name}</p>
              <p className={styles.email}>{CURRENT_USER.email}</p>
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
