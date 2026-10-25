import { useMemo } from 'react';
import { useCmsContent } from './useCmsContent';
import { useCmsText } from './useCmsText';
import { whatsappUrl } from './useSiteSettings';

export interface CmsContact {
  /** `null` when the admin switched the field off or left it empty. */
  phone: string | null;
  email: string | null;
  whatsappHref: string | null;
  address: string | null;
  hours: string | null;
}

/**
 * Contact details every section needs, already gated by the admin's
 * `*Enabled` toggles so a disabled field can never leak into the UI.
 */
export function useCmsContact(): CmsContact {
  const { content } = useCmsContent();
  const { text } = useCmsText();
  const footer = content.footer;
  const address = text(footer.addressAr, footer.addressEn).trim();
  const hours = text(footer.hoursAr, footer.hoursEn).trim();

  return useMemo(
    () => ({
      phone: footer.phoneEnabled && footer.phone.trim() ? footer.phone.trim() : null,
      email: footer.emailEnabled && footer.email.trim() ? footer.email.trim() : null,
      whatsappHref: footer.whatsappEnabled ? whatsappUrl(footer.whatsapp) : null,
      address: footer.addressEnabled && address ? address : null,
      hours: footer.hoursEnabled && hours ? hours : null,
    }),
    [
      footer.phoneEnabled,
      footer.phone,
      footer.emailEnabled,
      footer.email,
      footer.whatsappEnabled,
      footer.whatsapp,
      footer.addressEnabled,
      footer.hoursEnabled,
      address,
      hours,
    ]
  );
}