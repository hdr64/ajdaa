import { createContext } from 'react';
import { SITE_DEFAULTS, type SiteSettings } from '../services/settingsService';

export interface SiteSettingsContextType {
  settings: SiteSettings;
  /** Called by the admin after saving, so the public pages show the new values at once. */
  setSettings: (settings: SiteSettings) => void;
}

/** Without a provider (or before the fetch lands) the built-in values apply. */
export const SiteSettingsContext = createContext<SiteSettingsContextType>({
  settings: SITE_DEFAULTS,
  setSettings: () => {},
});
