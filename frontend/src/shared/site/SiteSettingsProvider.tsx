import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest } from '../api/client';
import { SITE_SETTINGS_URL } from '../config/api';
import { DEFAULT_SITE_SETTINGS, SiteSettingsContext, publicSiteSettings, type SiteSettings } from './siteSettings';

/** Sets (or removes) a `<meta name=…>` tag in the document head. */
function setMeta(name: string, content: string | null) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (content === null) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement('meta');
    tag.name = name;
    document.head.appendChild(tag);
  }
  tag.content = content;
}

/**
 * Loads the public site settings once and applies the SEO defaults to the
 * document: the meta description and, when indexing is turned off in
 * Configuración, a `noindex` robots tag.
 */
export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<SiteSettings>(SITE_SETTINGS_URL, { signal: controller.signal })
      .then((loaded) => setSettings({ ...DEFAULT_SITE_SETTINGS, ...loaded }))
      .catch(() => {
        // Keep the defaults: the site must work even if this request fails.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const description = settings.seoDescription || settings.siteDescription;
    setMeta('description', description || null);
    setMeta('robots', settings.seoIndexable ? null : 'noindex, nofollow');
  }, [settings]);

  const value = useMemo(
    () => ({ settings, update: (next: SiteSettings) => setSettings(publicSiteSettings(next)) }),
    [settings],
  );
  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}
