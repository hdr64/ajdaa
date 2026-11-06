/**
 * Readable project URLs: `/projects/villa-riyadh-206`. The slug comes from the
 * English title at runtime; the numeric id suffix keeps URLs unique and is the only
 * part used for lookup, so no schema change is needed. Keep identical to
 * `src/seo/slug.ts`.
 */
export function slugify(titleEn: string | null | undefined): string {
  const base = (titleEn ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base.length <= 60) return base;
  const cut = base.slice(0, 60);
  const dash = cut.lastIndexOf('-');
  return (dash > 0 ? cut.slice(0, dash) : cut).replace(/-+$/, '');
}

export function projectPath(id: number, titleEn: string | null | undefined): string {
  const slug = slugify(titleEn);
  return slug ? `/projects/${slug}-${id}` : `/projects/${id}`;
}
