import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AdminLayout } from '../../components/AdminLayout/AdminLayout';
import { Button } from '../../../shared/components/Button/Button';
import { FormField } from '../../../shared/components/FormField/FormField';
import { StatusBadge } from '../../../shared/components/StatusBadge/StatusBadge';
import { useDocumentTitle } from '../../../shared/hooks/useDocumentTitle';
import { apiRequest, ApiError } from '../../../shared/api/client';
import { ADMIN_SETTINGS_URL } from '../../../shared/config/api';
import type { EditableSiteSettings, SiteSettings } from '../../backoffice/types';
import f from '../../../shared/components/FormField/FormField.module.css';
import styles from './ConfiguracionPage.module.css';

const SECTIONS = [
  { id: 'general', label: 'General' }, { id: 'contacto', label: 'Contacto' },
  { id: 'seo', label: 'SEO' }, { id: 'integraciones', label: 'Integraciones' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];
type SettingsState = { status: 'loading' } | { status: 'ready'; response: SiteSettings; draft: EditableSiteSettings } | { status: 'error' };

function editableFields(settings: SiteSettings): EditableSiteSettings {
  const { siteName, siteDescription, supportEmail, newsletterEmail, senderName, seoTitle, seoDescription, seoIndexable } = settings;
  return { siteName, siteDescription, supportEmail, newsletterEmail, senderName, seoTitle, seoDescription, seoIndexable };
}

export function ConfiguracionPage() {
  useDocumentTitle('Configuración · Admin · Nuestra Medicina Personal');
  const [section, setSection] = useState<SectionId>('general');
  const [state, setState] = useState<SettingsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const retry = useCallback(() => { setState({ status: 'loading' }); setAttempt((value) => value + 1); }, []);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<SiteSettings>(ADMIN_SETTINGS_URL, { signal: controller.signal })
      .then((response) => setState({ status: 'ready', response, draft: editableFields(response) }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [attempt]);

  const update = <K extends keyof EditableSiteSettings>(key: K, value: EditableSiteSettings[K]) => {
    setMessage(null);
    setState((current) => current.status === 'ready' ? { ...current, draft: { ...current.draft, [key]: value } } : current);
  };

  const save = async () => {
    if (state.status !== 'ready') return;
    const submittedDraft = state.draft;
    setSaving(true); setMessage(null);
    try {
      const response = await apiRequest<SiteSettings>(ADMIN_SETTINGS_URL, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.draft),
      });
      setState((current) => current.status === 'ready' ? {
        status: 'ready',
        response,
        draft: current.draft === submittedDraft ? editableFields(response) : current.draft,
      } : current);
      setMessage('Cambios guardados.');
    } catch (error: unknown) {
      setMessage(error instanceof ApiError && error.status === 422 ? 'Revisá los campos: hay valores inválidos.' : error instanceof ApiError && error.status === 429 ? 'Alcanzaste el límite de cambios. Esperá un minuto y reintentá.' : 'No pudimos guardar los cambios. Intentá nuevamente.');
    } finally { setSaving(false); }
  };

  return <AdminLayout title="Configuración">
    {state.status === 'loading' ? <div className={styles.feedback} role="status">Cargando configuración…</div> : state.status === 'error' ? <div className={styles.feedback} role="alert"><p>No pudimos cargar la configuración.</p><Button variant="secondary" onClick={retry}>Reintentar</Button></div> : (
      <div className={styles.layout}>
        <nav className={styles.sectionNav}>{SECTIONS.map((item) => <button key={item.id} type="button" onClick={() => { setMessage(null); setSection(item.id); }} className={[styles.navButton, section === item.id ? styles.navButtonActive : ''].join(' ')}>{item.label}</button>)}</nav>
        <div className={styles.content}>
          {section === 'general' && <SettingsCard title="General" onSave={save} saving={saving} message={message}>
            <FormField label="Nombre del sitio" htmlFor="siteName"><input id="siteName" className={[f.control, styles.narrow].join(' ')} value={state.draft.siteName} onChange={(event) => update('siteName', event.target.value)} /></FormField>
            <FormField label="Descripción breve" htmlFor="siteDescription"><textarea id="siteDescription" rows={2} className={[f.control, styles.wide].join(' ')} value={state.draft.siteDescription} onChange={(event) => update('siteDescription', event.target.value)} /></FormField>
            <FormField label="Correo de soporte" htmlFor="supportEmail"><input id="supportEmail" type="email" className={[f.control, styles.narrow].join(' ')} value={state.draft.supportEmail} onChange={(event) => update('supportEmail', event.target.value)} /></FormField>
          </SettingsCard>}
          {section === 'contacto' && <SettingsCard title="Contacto" onSave={save} saving={saving} message={message}>
            <FormField label="Correo de soporte" htmlFor="supportEmail2"><input id="supportEmail2" type="email" className={[f.control, styles.narrow].join(' ')} value={state.draft.supportEmail} onChange={(event) => update('supportEmail', event.target.value)} /></FormField>
            <FormField label="Correo de novedades" htmlFor="newsletterEmail"><input id="newsletterEmail" type="email" className={[f.control, styles.narrow].join(' ')} value={state.draft.newsletterEmail} onChange={(event) => update('newsletterEmail', event.target.value)} /></FormField>
            <FormField label="Nombre del remitente" htmlFor="senderName"><input id="senderName" className={[f.control, styles.narrow].join(' ')} value={state.draft.senderName} onChange={(event) => update('senderName', event.target.value)} /></FormField>
          </SettingsCard>}
          {section === 'seo' && <SettingsCard title="SEO general" onSave={save} saving={saving} message={message}>
            <FormField label="Título SEO por defecto" htmlFor="seoTitle"><input id="seoTitle" className={[f.control, styles.medium].join(' ')} value={state.draft.seoTitle} onChange={(event) => update('seoTitle', event.target.value)} /></FormField>
            <FormField label="Descripción SEO por defecto" htmlFor="seoDescription"><textarea id="seoDescription" rows={2} className={[f.control, styles.wide].join(' ')} value={state.draft.seoDescription} onChange={(event) => update('seoDescription', event.target.value)} /></FormField>
            <div className={styles.checkboxRow}><input type="checkbox" id="seoIndexable" checked={state.draft.seoIndexable} onChange={(event) => update('seoIndexable', event.target.checked)} /><label htmlFor="seoIndexable" className={styles.checkboxLabel}>Permitir indexación general del sitio</label></div>
          </SettingsCard>}
          {section === 'integraciones' && <Integrations settings={state.response} />}
        </div>
      </div>
    )}
  </AdminLayout>;
}

function SettingsCard({ title, onSave, saving, message, children }: { title: string; onSave: () => void; saving: boolean; message: string | null; children: ReactNode }) {
  return <div className={styles.card}><h2 className={styles.cardTitle}>{title}</h2>{children}{message && <p className={styles.saveMessage} role="status">{message}</p>}<Button variant="primary" className={styles.saveButton} disabled={saving} onClick={onSave}>{saving ? 'Guardando…' : 'Guardar'}</Button></div>;
}

function Integrations({ settings }: { settings: SiteSettings }) {
  const integrations = [
    { name: 'Google', hint: 'Autenticación de clientes (OpenID Connect)', configured: settings.integrations.google.configured },
    { name: 'Mercado Pago', hint: 'Checkout Pro para el cobro de libros', configured: settings.integrations.mercadoPago.configured },
    { name: 'Correo', hint: 'Envío de correos transaccionales y novedades', configured: settings.integrations.email.configured },
  ];
  return <div className={styles.integrationsList}>{integrations.map((integration) => <div key={integration.name} className={styles.integrationCard}><div><p className={styles.integrationName}>{integration.name}</p><p className={styles.integrationHint}>{integration.hint}</p></div><StatusBadge tone={integration.configured ? 'success' : 'pending'}>{integration.configured ? 'Configurado' : 'Pendiente de configurar'}</StatusBadge></div>)}</div>;
}
