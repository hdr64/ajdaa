import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { ZipArchive, type ZipEntryData } from 'archiver';
import { prisma } from './prisma.js';
import { DriveError, cleanName, driveFilePath, withSuffix, type ItemIds } from './driveService.js';

/**
 * Download of Drive folders and selections as one zip, streamed from the server.
 *
 * A plain browser download cannot send the `Authorization` header and fetching the
 * archive into a blob would hold it all in memory, so the flow is two steps: an
 * authenticated POST creates a short-lived single-use ticket, then the browser
 * navigates to a GET URL that carries the ticket and streams straight to disk.
 */

export const ZIP_TICKET_TTL_MS = 60_000;
export const ZIP_MAX_ENTRIES = 20_000;
export const ZIP_MAX_CONCURRENT = 2;
/** Archives that may exceed 4 GB carry zip64 headers from the start. */
const FORCE_ZIP64_BYTES = 3.5 * 1024 ** 3;
const MAX_DEPTH = 64;
const FOLDER_BATCH = 500;

/** Extensions that are already compressed: storing them beats burning CPU for nothing. */
const STORE_EXTENSIONS = new Set([
  '.zip', '.gz', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.mkv', '.webm',
  '.mp3', '.m4a', '.pdf', '.docx', '.xlsx', '.pptx', '.7z', '.rar', '.glb',
]);

/* --------------------------------- tickets -------------------------------- */

interface Ticket {
  folderIds: string[];
  fileIds: string[];
  name?: string;
  adminId?: string;
  expiresAt: number;
}

const tickets = new Map<string, Ticket>();

function sweepExpired(now: number): void {
  for (const [token, ticket] of tickets) {
    if (ticket.expiresAt <= now) tickets.delete(token);
  }
}

/** Every id must exist and be out of the trash, otherwise the whole request is a 404. */
async function requireLiveItems({ folderIds, fileIds }: ItemIds): Promise<void> {
  const [folders, files] = await Promise.all([
    folderIds.length > 0 ? prisma.driveFolder.count({ where: { id: { in: folderIds }, trashedAt: null } }) : 0,
    fileIds.length > 0 ? prisma.driveFile.count({ where: { id: { in: fileIds }, trashedAt: null } }) : 0,
  ]);
  if (folders !== folderIds.length || files !== fileIds.length) throw new DriveError('Item not found', 404);
}

/** Validates the selection and returns a single-use token valid for `ttlMs`. */
export async function createZipTicket(
  input: ItemIds & { name?: string },
  adminId?: string,
  ttlMs: number = ZIP_TICKET_TTL_MS
): Promise<string> {
  const folderIds = [...new Set(input.folderIds)];
  const fileIds = [...new Set(input.fileIds)];
  if (folderIds.length + fileIds.length === 0) throw new DriveError('Nothing selected', 400);
  await requireLiveItems({ folderIds, fileIds });

  const now = Date.now();
  sweepExpired(now);
  const token = crypto.randomBytes(24).toString('hex');
  tickets.set(token, { folderIds, fileIds, name: input.name, adminId, expiresAt: now + ttlMs });
  return token;
}

/** Returns the ticket and deletes it (single use). `null` when unknown or expired. */
export function takeZipTicket(token: string): Ticket | null {
  const ticket = tickets.get(token);
  if (!ticket) return null;
  tickets.delete(token);
  return ticket.expiresAt > Date.now() ? ticket : null;
}

/* ------------------------------- concurrency ------------------------------ */

let activeZips = 0;

/** At most `ZIP_MAX_CONCURRENT` archives stream at once, process-wide. */
export function acquireZipSlot(): boolean {
  if (activeZips >= ZIP_MAX_CONCURRENT) return false;
  activeZips += 1;
  return true;
}

export function releaseZipSlot(): void {
  activeZips = Math.max(0, activeZips - 1);
}

/* ---------------------------------- plan ---------------------------------- */

export type ZipPlanEntry =
  | { kind: 'file'; zipPath: string; storageKey: string; size: number }
  | { kind: 'dir'; zipPath: string };

export interface ZipPlan {
  entries: ZipPlanEntry[];
  zipName: string;
  totalBytes: number;
}

interface LiveFolder {
  id: string;
  name: string;
  parentId: string | null;
}

interface LiveFile {
  id: string;
  name: string;
  folderId: string | null;
  storageKey: string;
  size: bigint;
}

/** The first free name among the siblings in one zip directory: `a.txt`, `a (2).txt`... (case-insensitive). */
function takeName(used: Set<string>, name: string, isFile: boolean): string {
  let candidate = name;
  for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = withSuffix(name, n, isFile);
  used.add(candidate.toLowerCase());
  return candidate;
}

function zipFileName(requested: string | undefined, selectedFolders: LiveFolder[], selectedFileCount: number): string {
  if (requested !== undefined && requested.trim() !== '') {
    const clean = cleanName(requested);
    return /\.zip$/i.test(clean) ? clean : `${clean}.zip`;
  }
  if (selectedFolders.length === 1 && selectedFileCount === 0) return `${cleanName(selectedFolders[0].name)}.zip`;
  return `drive-${new Date().toISOString().slice(0, 10)}.zip`;
}

/**
 * Lists every entry of the archive before any byte is sent, so a too-big selection
 * is a clean 413 and the headers can still be set. Folders come from one query of
 * the live folder table (it is small); files are fetched per batch of folder ids.
 */
export async function planZip(ticket: Pick<Ticket, 'folderIds' | 'fileIds' | 'name'>): Promise<ZipPlan> {
  const liveFolders: LiveFolder[] = await prisma.driveFolder.findMany({
    where: { trashedAt: null },
    select: { id: true, name: true, parentId: true },
    orderBy: { name: 'asc' },
  });
  const byId = new Map(liveFolders.map((f) => [f.id, f]));
  const childrenOf = new Map<string, LiveFolder[]>();
  for (const folder of liveFolders) {
    if (!folder.parentId) continue;
    const list = childrenOf.get(folder.parentId) ?? [];
    list.push(folder);
    childrenOf.set(folder.parentId, list);
  }

  const roots: LiveFolder[] = [];
  for (const id of ticket.folderIds) {
    const folder = byId.get(id);
    if (!folder) throw new DriveError('Item not found', 404);
    roots.push(folder);
  }

  // A folder selected together with one of its ancestors is already inside the archive.
  const descendantsOf = (rootId: string): Set<string> => {
    const seen = new Set<string>([rootId]);
    let level = [rootId];
    for (let depth = 0; level.length > 0 && depth < MAX_DEPTH; depth++) {
      level = level.flatMap((id) => (childrenOf.get(id) ?? []).map((c) => c.id)).filter((id) => !seen.has(id));
      level.forEach((id) => seen.add(id));
    }
    return seen;
  };
  const subtree = new Map(roots.map((f) => [f.id, descendantsOf(f.id)]));
  const topFolders = roots.filter((f) => !roots.some((other) => other.id !== f.id && subtree.get(other.id)?.has(f.id)));
  const insideSelection = new Set<string>();
  for (const f of topFolders) subtree.get(f.id)?.forEach((id) => insideSelection.add(id));

  const looseFiles: LiveFile[] =
    ticket.fileIds.length > 0
      ? await prisma.driveFile.findMany({
          where: { id: { in: ticket.fileIds }, trashedAt: null },
          select: { id: true, name: true, folderId: true, storageKey: true, size: true },
        })
      : [];
  if (looseFiles.length !== ticket.fileIds.length) throw new DriveError('Item not found', 404);
  const topFiles = looseFiles.filter((f) => !f.folderId || !insideSelection.has(f.folderId));

  const folderIdsToRead = [...insideSelection];
  const filesOf = new Map<string, LiveFile[]>();
  for (let i = 0; i < folderIdsToRead.length; i += FOLDER_BATCH) {
    const rows: LiveFile[] = await prisma.driveFile.findMany({
      where: { trashedAt: null, folderId: { in: folderIdsToRead.slice(i, i + FOLDER_BATCH) } },
      select: { id: true, name: true, folderId: true, storageKey: true, size: true },
      orderBy: { name: 'asc' },
    });
    for (const row of rows) {
      const list = filesOf.get(row.folderId as string) ?? [];
      list.push(row);
      filesOf.set(row.folderId as string, list);
    }
  }

  const entries: ZipPlanEntry[] = [];
  let totalBytes = 0;
  const tooMany = () => new DriveError('Too many items for one zip', 413);

  const addFile = (file: LiveFile, zipDir: string, name: string) => {
    if (entries.length >= ZIP_MAX_ENTRIES) throw tooMany();
    const size = Number(file.size);
    totalBytes += size;
    entries.push({ kind: 'file', zipPath: zipDir ? `${zipDir}/${name}` : name, storageKey: file.storageKey, size });
  };

  const walk = (folder: LiveFolder, zipDir: string, depth: number): void => {
    if (depth > MAX_DEPTH) throw new DriveError('Folders are nested too deeply', 400);
    const children = childrenOf.get(folder.id) ?? [];
    const files = filesOf.get(folder.id) ?? [];
    if (children.length === 0 && files.length === 0) {
      if (entries.length >= ZIP_MAX_ENTRIES) throw tooMany();
      entries.push({ kind: 'dir', zipPath: zipDir });
      return;
    }
    const used = new Set<string>();
    for (const child of children) walk(child, `${zipDir}/${takeName(used, cleanName(child.name), false)}`, depth + 1);
    for (const file of files) addFile(file, zipDir, takeName(used, cleanName(file.name), true));
  };

  // Selected folders become top-level directories, selected files sit at the zip root.
  const usedAtRoot = new Set<string>();
  for (const folder of topFolders) walk(folder, takeName(usedAtRoot, cleanName(folder.name), false), 0);
  for (const file of topFiles) addFile(file, '', takeName(usedAtRoot, cleanName(file.name), true));

  return {
    entries,
    zipName: zipFileName(ticket.name, topFolders, topFiles.length),
    totalBytes,
  };
}

/* --------------------------------- stream --------------------------------- */

/**
 * Builds the archive stream for a plan. A file whose bytes are missing on disk is
 * skipped (and reported to `onMissing`) instead of failing the whole download.
 * The caller pipes the result to the response and may call `abort()` on disconnect.
 */
export async function buildZipArchive(plan: ZipPlan, onMissing: (entry: ZipPlanEntry) => void): Promise<ZipArchive> {
  const archive = new ZipArchive({
    zlib: { level: 1 },
    forceZip64: plan.totalBytes >= FORCE_ZIP64_BYTES,
  });

  for (const entry of plan.entries) {
    if (entry.kind === 'dir') {
      archive.append('', { name: `${entry.zipPath}/`, type: 'directory' });
      continue;
    }
    let source: string;
    try {
      source = driveFilePath(entry.storageKey);
      await fs.access(source);
    } catch {
      onMissing(entry);
      continue;
    }
    const data: ZipEntryData = {
      name: entry.zipPath,
      store: STORE_EXTENSIONS.has(path.extname(entry.zipPath).toLowerCase()),
    };
    archive.file(source, data);
  }
  return archive;
}
