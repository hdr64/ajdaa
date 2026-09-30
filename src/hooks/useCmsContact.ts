import { useMemo } from 'react';
import { useCmsContent } from './useCmsContent';
import { whatsappUrl } from './useSiteSettings';

export interface CmsContact {
  /** `null` when the admin switched the field off or left it empty. */
  phone: string | null;
  email: string | null;
  whatsappHref: string | null;
}

/**
 * Contact details every section needs, already gated by the admin's
 * `*Enabled` toggles so a disabled field can never leak into the UI.
 */
export function useCmsContact(): CmsContact {
  const { content } = useCmsContent();
  const footer = content.footer;

  return useMemo(
    () => ({
      phone: footer.phoneEnabled && footer.phone.trim() ? footer.phone.trim() : null,
      email: footer.emailEnabled && footer.email.trim() ? footer.email.trim() : null,
      whatsappHref: footer.whatsappEnabled ? whatsappUrl(footer.whatsapp) : null,
    }),
    [footer.phoneEnabled, footer.phone, footer.emailEnabled, footer.email, footer.whatsappEnabled, footer.whatsapp]
  );
}