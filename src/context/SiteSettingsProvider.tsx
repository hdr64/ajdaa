import React, { useEffect, useMemo, useState } from 'react';
import { siteSettingsApi, SITE_DEFAULTS, type SiteSettings } from '../services/settingsService';
import { SiteSettingsContext } from './siteSettingsContextDef';

/**
 * Loads the public site settings once. The built-in defaults render first and
 * stay in place if the API is unreachable, so the contact details never blank out.
 */
export const SiteSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings>(SITE_DEFAULTS);

  useEffect(() => {
    const controller = new AbortController();
    siteSettingsApi
      .get(controller.signal)
      // Merge over the defaults so a field an older API does not send yet
      // (for example `careers`) can never be undefined and crash the render.
      .then((remote) =>
        setSettings({
          ...SITE_DEFAULTS,
          ...remote,
          socials: { ...SITE_DEFAULTS.socials, ...remote.socials },
          announcement: { ...SITE_DEFAULTS.announcement, ...remote.announcement },
          maintenance: { ...SITE_DEFAULTS.maintenance, ...remote.maintenance },
          careers: { ...SITE_DEFAULTS.careers, ...remote.careers },
        })
      )
      .catch(() => {
        // Keep the defaults; the site stays usable without the API.
      });
    return () => controller.abort();
  }, []);

  const value = useMemo(() => ({ settings, setSettings }), [settings]);
  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
};
