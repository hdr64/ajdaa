import { useEffect } from 'react';
import type { ClientSeoMeta } from '../seo/pageMeta';

/** Same escaping as the server, so a title can never close the script tag. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function add(tag: 'meta' | 'link', attrs: Record<string, string>): void {
  const el = document.createElement(tag);
  el.setAttribute('data-seo', '1');
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  document.head.appendChild(el);
}

/**
 * Keeps the document head in step with the current route and language.
 * The server injects the first set of tags with `data-seo="1"`; this hook
 * replaces all of them, so there are never duplicates. On the home page the
 * server's richer JSON-LD (organisation, address, social profiles) is kept
 * because the client has no better data: the hook only skips replacing
 * JSON-LD there.
 */
export function useSeo(meta: ClientSeoMeta, origin: string, keepServerJsonLd: boolean): void {
  const key = JSON.stringify(meta) + String(keepServerJsonLd);

  useEffect(() => {
    const keptLd = keepServerJsonLd
      ? Array.from(document.head.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"][data-seo]'))
      : [];
    document.head.querySelectorAll('[data-seo]').forEach((el) => {
      // The <title> element is kept and rewritten through document.title.
      if (el.tagName !== 'TITLE' && !keptLd.includes(el as HTMLScriptElement)) el.remove();
    });
    // The admin dashboard sets its own per-section title; only fill in when it has none yet.
    if (!meta.social && meta.robots.startsWith('noindex')) {
      if (!document.title) document.title = meta.title;
    } else {
      document.title = meta.title;
    }

    if (meta.description) add('meta', { name: 'description', content: meta.description });
    if (meta.canonical) add('link', { rel: 'canonical', href: meta.canonical });
    add('meta', { name: 'robots', content: meta.robots });

    if (meta.social) {
      const og: [string, string][] = [
        ['og:type', 'website'],
        ['og:site_name', meta.locale === 'ar_SA' ? 'أجدا العقارية' : 'Ajda Real Estate'],
        ['og:title', meta.title],
        ['og:description', meta.description],
        ['og:url', meta.canonical ?? origin],
        ['og:image', meta.image],
        ['og:image:alt', meta.imageAlt],
        ['og:locale', meta.locale],
        ['og:locale:alternate', meta.locale === 'ar_SA' ? 'en_US' : 'ar_SA'],
      ];
      for (const [property, content] of og) if (content) add('meta', { property, content });
      add('meta', { name: 'twitter:card', content: 'summary_large_image' });
      add('meta', { name: 'twitter:title', content: meta.title });
      if (meta.description) add('meta', { name: 'twitter:description', content: meta.description });
      add('meta', { name: 'twitter:image', content: meta.image });
      for (const item of meta.jsonLd) {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-seo', '1');
        script.textContent = jsonForScript(item);
        document.head.appendChild(script);
      }
    }
    // `key` is the serialised input; `meta` is a new object on every render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key, origin]);
}
