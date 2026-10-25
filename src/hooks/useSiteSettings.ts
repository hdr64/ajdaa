import { useContext } from 'react';
import { SiteSettingsContext, type SiteSettingsContextType } from '../context/siteSettingsContextDef';

export const useSiteSettings = (): SiteSettingsContextType => useContext(SiteSettingsContext);

/** wa.me link for the configured WhatsApp number, or null when none is set. */
export const whatsappUrl = (digits: string): string | null => (digits ? `https://wa.me/${digits}` : null);
