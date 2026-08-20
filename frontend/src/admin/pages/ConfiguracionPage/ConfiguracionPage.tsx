import { useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { FormField } from '../../../shared/components/FormField/FormField';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import f from '../../../shared/components/FormField/FormField.module.css';
import styles from './ConfiguracionPage.module.css';

const SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'contacto', label: 'Contacto' },
  { id: 'seo', label: 'SEO' },
  { id: 'integraciones', label: 'Integraciones' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

interface Settings {
  siteName: string;
  siteDescription: string;
  supportEmail: string;
  newsletterEmail: string;
  senderName: string;
  seoTitle: string;
  seoDescription: string;
  seoIndexable: boolean;
}

const INITIAL_SETTINGS: Settings = {
  siteName: 'Nuestra Medicina Personal',
  siteDescription: 'Escritura, reflexión y herramientas para procesos personales y educativos.',
  supportEmail: 'soporte@nuestramedicinapersonal.com',
  newsletterEmail: 'novedades@nuestramedicinapersonal.com',
  senderName: 'Nuestra Medicina Personal',
  seoTitle: 'Nuestra Medicina Personal — Escritura y reflexión',
  seoDescription: 'Libros y herramientas de escritura y reflexión personal.',
  seoIndexable: true,
};

const INTEGRATIONS = [
  { name: 'Google', hint: 'Autenticación de clientes (OpenID Connect)', status: 'Conectado' as const },
  { name: 'Mercado Pago', hint: 'Checkout Pro para el cobro de libros', status: 'Conectado' as const },
  {
    name: 'Correo',
    hint: 'Envío de correos transaccionales y novedades',
    status: 'Pendiente de configurar' as const,
  },
];

/** `/admin/configuracion` — site settings, built from Admin Configuracion.dc.html. */
export function ConfiguracionPage() {
  useDocumentTitle('Configuración · Admin · Nuestra Medicina Personal');

  const [section, setSection] = useState<SectionId>('general');
  const [settings, setSettings] = useState<Settings>(INITIAL_SETTINGS);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    try {
      await fetch('/api/v1/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    } catch {
      // Loading persisted settings and surfacing API errors are part of
      // the final transport integration.
    }
  };

  return (
    <AdminLayout title="Configuración">
      <div className={styles.layout}>
        <nav className={styles.sectionNav}>
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={[styles.navButton, section === item.id ? styles.navButtonActive : ''].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className={styles.content}>
          {section === 'general' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>General</h2>
              <FormField label="Nombre del sitio" htmlFor="siteName">
                <input
                  id="siteName"
                  type="text"
                  className={[f.control, styles.narrow].join(' ')}
                  value={settings.siteName}
                  onChange={(e) => update('siteName', e.target.value)}
                />
              </FormField>
              <FormField label="Descripción breve" htmlFor="siteDescription">
                <textarea
                  id="siteDescription"
                  rows={2}
                  className={[f.control, styles.wide].join(' ')}
                  value={settings.siteDescription}
                  onChange={(e) => update('siteDescription', e.target.value)}
                />
              </FormField>
              <FormField label="Correo de soporte" htmlFor="supportEmail">
                <input
                  id="supportEmail"
                  type="text"
                  className={[f.control, styles.narrow].join(' ')}
                  value={settings.supportEmail}
                  onChange={(e) => update('supportEmail', e.target.value)}
                />
              </FormField>
              <Button variant="primary" className={styles.saveButton} onClick={save}>
                Guardar
              </Button>
            </div>
          )}

          {section === 'contacto' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Contacto</h2>
              <FormField label="Correo de soporte" htmlFor="supportEmail2">
                <input
                  id="supportEmail2"
                  type="text"
                  className={[f.control, styles.narrow].join(' ')}
                  value={settings.supportEmail}
                  onChange={(e) => update('supportEmail', e.target.value)}
                />
              </FormField>
              <FormField label="Correo de novedades" htmlFor="newsletterEmail">
                <input
                  id="newsletterEmail"
                  type="text"
                  className={[f.control, styles.narrow].join(' ')}
                  value={settings.newsletterEmail}
                  onChange={(e) => update('newsletterEmail', e.target.value)}
                />
              </FormField>
              <FormField label="Nombre del remitente" htmlFor="senderName">
                <input
                  id="senderName"
                  type="text"
                  className={[f.control, styles.narrow].join(' ')}
                  value={settings.senderName}
                  onChange={(e) => update('senderName', e.target.value)}
                />
              </FormField>
              <Button variant="primary" className={styles.saveButton} onClick={save}>
                Guardar
              </Button>
            </div>
          )}

          {section === 'seo' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>SEO general</h2>
              <FormField label="Título SEO por defecto" htmlFor="seoTitle">
                <input
                  id="seoTitle"
                  type="text"
                  className={[f.control, styles.medium].join(' ')}
                  value={settings.seoTitle}
                  onChange={(e) => update('seoTitle', e.target.value)}
                />
              </FormField>
              <FormField label="Descripción SEO por defecto" htmlFor="seoDescription">
                <textarea
                  id="seoDescription"
                  rows={2}
                  className={[f.control, styles.wide].join(' ')}
                  value={settings.seoDescription}
                  onChange={(e) => update('seoDescription', e.target.value)}
                />
              </FormField>
              <div className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  id="seoIndexable"
                  checked={settings.seoIndexable}
                  onChange={(e) => update('seoIndexable', e.target.checked)}
                />
                <label htmlFor="seoIndexable" className={styles.checkboxLabel}>
                  Permitir indexación general del sitio
                </label>
              </div>
              <Button variant="primary" className={styles.saveButton} onClick={save}>
                Guardar
              </Button>
            </div>
          )}

          {section === 'integraciones' && (
            <div className={styles.integrationsList}>
              {INTEGRATIONS.map((integration) => (
                <div key={integration.name} className={styles.integrationCard}>
                  <div>
                    <p className={styles.integrationName}>{integration.name}</p>
                    <p className={styles.integrationHint}>{integration.hint}</p>
                  </div>
                  <StatusBadge tone={integration.status === 'Conectado' ? 'success' : 'pending'}>
                    {integration.status}
                  </StatusBadge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
