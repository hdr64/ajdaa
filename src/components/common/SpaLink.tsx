import React from 'react';
import { pathForPage, type SeoPage } from '../../seo/paths';
import { useLanguage } from '../../hooks/useLanguage';

type SpaLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'> & {
  page: SeoPage;
  projectId?: number;
  /** English title of the project, used for the readable URL slug. */
  projectTitleEn?: string | null;
  /** Force a specific language for this link, defaults to current active language. */
  lang?: 'ar' | 'en';
  /** Runs the app's own navigation (history push, transition). */
  onNavigate: () => void;
  /** Optional extra work on a plain click (e.g. closing a menu). */
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
};

/**
 * A real `<a href>` for public navigation, so crawlers, "open in new tab" and
 * copy-link all work, while a plain click still navigates inside the SPA.
 * Modified clicks are left to the browser. It stops propagation because cards
 * wrap it in their own click handler and the page must not navigate twice.
 */
export const SpaLink: React.FC<SpaLinkProps> = ({
  page,
  projectId,
  projectTitleEn,
  lang: forcedLang,
  onNavigate,
  onClick,
  children,
  ...rest
}) => {
  const { language } = useLanguage();
  const activeLang = forcedLang ?? language;

  return (
    <a
      {...rest}
      href={pathForPage(page, projectId, projectTitleEn, activeLang)}
      onClick={(event) => {
        event.stopPropagation();
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        event.preventDefault();
        onClick?.(event);
        onNavigate();
      }}
    >
      {children}
    </a>
  );
};
