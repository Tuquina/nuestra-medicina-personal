import { createContext, useContext } from 'react';

/**
 * The public part of the admin's Configuración (`GET /api/v1/site`): what
 * the site shows in its footer and tells search engines. Split from the
 * provider component so Fast Refresh keeps working (same reason as
 * shared/auth/useAuth.ts).
 */
export interface SiteSettings {
  siteName: string;
  siteDescription: string;
  supportEmail: string;
  seoTitle: string;
  seoDescription: string;
  seoIndexable: boolean;
}

/** Used until the API answers, or if it can't be reached. */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: 'Nuestra Medicina Personal',
  siteDescription: '',
  supportEmail: 'soporte@nuestramedicinapersonal.com',
  seoTitle: '',
  seoDescription: '',
  seoIndexable: true,
};

interface SiteSettingsContextValue {
  settings: SiteSettings;
  /** Replaces the loaded settings, e.g. right after Configuración saves them. */
  update: (settings: SiteSettings) => void;
}

export const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: DEFAULT_SITE_SETTINGS,
  update: () => undefined,
});

export function useSiteSettings(): SiteSettings {
  return useContext(SiteSettingsContext).settings;
}

/** Lets the admin's Configuración push freshly saved values to the whole app. */
export function useUpdateSiteSettings(): (settings: SiteSettings) => void {
  return useContext(SiteSettingsContext).update;
}

/** Keeps only the public fields of a settings object (e.g. the admin's full response). */
export function publicSiteSettings(settings: SiteSettings): SiteSettings {
  const { siteName, siteDescription, supportEmail, seoTitle, seoDescription, seoIndexable } = settings;
  return { siteName, siteDescription, supportEmail, seoTitle, seoDescription, seoIndexable };
}
