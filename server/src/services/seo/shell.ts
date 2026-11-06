import { escapeHtml, jsonForScript } from './escape.js';
import { BRAND_AR, BRAND_EN } from './pages.js';
import type { PageMeta } from './meta.js';

/** Every injected tag carries this attribute; the client hook (`src/hooks/useSeo.ts`) replaces them on navigation. */
const ATTR = 'data-seo="1"';

export function buildHeadTags(meta: PageMeta): string {
  const tags: string[] = [`<title ${ATTR}>${escapeHtml(meta.title)}</title>`];
  if (meta.description) {
    tags.push(`<meta ${ATTR} name="description" content="${escapeHtml(meta.description)}" />`);
  }
  if (meta.canonical) tags.push(`<link ${ATTR} rel="canonical" href="${escapeHtml(meta.canonical)}" />`);
  if (meta.hreflang) {
    tags.push(`<link ${ATTR} rel="alternate" hreflang="ar" href="${escapeHtml(meta.hreflang.ar)}" />`);
    tags.push(`<link ${ATTR} rel="alternate" hreflang="en" href="${escapeHtml(meta.hreflang.en)}" />`);
    tags.push(`<link ${ATTR} rel="alternate" hreflang="x-default" href="${escapeHtml(meta.hreflang.xDefault)}" />`);
  }
  tags.push(`<meta ${ATTR} name="robots" content="${escapeHtml(meta.robots)}" />`);

  if (meta.social) {
    const isEn = meta.lang === 'en';
    const siteName = isEn ? BRAND_EN : BRAND_AR;
    const locale = isEn ? 'en_US' : 'ar_SA';
    const localeAlt = isEn ? 'ar_SA' : 'en_US';
    const og: [string, string][] = [
      ['og:type', 'website'],
      ['og:site_name', siteName],
      ['og:title', meta.title],
      ['og:description', meta.description],
      ['og:url', meta.canonical ?? ''],
      ['og:image', meta.image],
      ['og:image:alt', meta.imageAlt],
      ['og:locale', locale],
      ['og:locale:alternate', localeAlt],
    ];
    for (const [property, content] of og) {
      if (content) tags.push(`<meta ${ATTR} property="${property}" content="${escapeHtml(content)}" />`);
    }
    const tw: [string, string][] = [
      ['twitter:card', 'summary_large_image'],
      ['twitter:title', meta.title],
      ['twitter:description', meta.description],
      ['twitter:image', meta.image],
    ];
    for (const [name, content] of tw) {
      if (content) tags.push(`<meta ${ATTR} name="${name}" content="${escapeHtml(content)}" />`);
    }
    for (const item of meta.jsonLd) {
      tags.push(`<script ${ATTR} type="application/ld+json">${jsonForScript(item)}</script>`);
    }
  }
  return tags.join('\n    ');
}

/** Injects the SEO tags into the built `index.html` and the noscript block before `<div id="root">`. */
export function renderShell(template: string, meta: PageMeta): string {
  let html = template.replace(/<title>[\s\S]*?<\/title>\s*/i, '');
  if (meta.lang === 'en') {
    html = html.replace(/<html\b([^>]*)>/i, (_match, attrs) => {
      const updated = attrs
        .replace(/\blang="[^"]*"/i, 'lang="en"')
        .replace(/\bdir="[^"]*"/i, 'dir="ltr"');
      return `<html${updated}>`;
    });
  }
  // `$` in replacement strings is special; use a function so project text is inserted verbatim.
  html = html.replace(/<\/head>/i, () => `    ${buildHeadTags(meta)}\n  </head>`);
  if (meta.noscriptHtml) {
    html = html.replace(/<div id="root">/i, () => `${meta.noscriptHtml}\n    <div id="root">`);
  }
  return html;
}
