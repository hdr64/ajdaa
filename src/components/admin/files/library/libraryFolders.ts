import type { MediaFolderDto } from '../../../../services/mediaService';

/** Pure helpers over the flat folder list; no fetching, no state. */

/** Folders directly inside `parentId` (null = library root), sorted by name. */
export function childFolders(folders: MediaFolderDto[], parentId: string | null): MediaFolderDto[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The path from the root down to and including `folderId`: crumbs for the breadcrumb. */
export function folderPath(folders: MediaFolderDto[], folderId: string | null): { id: string; name: string }[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const out: { id: string; name: string }[] = [];
  let current = folderId;
  for (let guard = 0; current && byId.has(current) && guard < 64; guard++) {
    const node = byId.get(current);
    if (!node) break;
    out.unshift({ id: node.id, name: node.name });
    current = node.parentId;
  }
  return out;
}

/** `A / B / C` for a file's folder chip; empty when the file sits at the root. */
export function folderPathLabel(folders: MediaFolderDto[], folderId: string | null | undefined): string {
  if (!folderId) return '';
  return folderPath(folders, folderId)
    .map((crumb) => crumb.name)
    .join(' / ');
}

/** `folderId` itself and everything below it — the ids that cannot be its move target. */
export function descendantFolderIds(folders: MediaFolderDto[], folderId: string): Set<string> {
  const out = new Set<string>([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (folder.parentId && out.has(folder.parentId) && !out.has(folder.id)) {
        out.add(folder.id);
        grew = true;
      }
    }
  }
  return out;
}
