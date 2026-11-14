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

export const SiteSettingsContext = createContext<SiteSettings>(DEFAULT_SITE_SETTINGS);

export function useSiteSettings(): SiteSettings {
  return useContext(SiteSettingsContext);
}
