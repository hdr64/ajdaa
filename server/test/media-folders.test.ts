import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/services/prisma.js';
import { authInject, closeApp, getApp, seedSession } from './helpers.js';

/**
 * Library folders: virtual folders for the media library (server side only).
 * Files are never touched on disk; only the rows move.
 */

let superAdminToken: string;

type FolderDto = { id: string; name: string; parentId: string | null; fileCount: number; createdAt: string };
type MoveResult = { moved: number };
type DeleteResult = { success: boolean; movedFiles: number; movedFolders: number };

const createdFolderIds: string[] = [];
const createdMediaIds: string[] = [];

beforeAll(async () => {
  await getApp();
  superAdminToken = (await seedSession('admin@ajdaa.sa')).token;
});

afterAll(async () => {
  await prisma.mediaFile.updateMany({ where: { id: { in: createdMediaIds } }, data: { folderId: null } });
  await prisma.mediaFile.deleteMany({ where: { id: { in: createdMediaIds } } });
  // Folders are deleted leaves-first (children before their parents) so the
  // Restrict foreign key is never hit. Folders a test already deleted are no-ops.
  const remaining = new Set(createdFolderIds);
  for (let guard = 0; remaining.size > 0 && guard <= createdFolderIds.length + 1; guard++) {
    const rows = await prisma.mediaFolder.findMany({
      where: { id: { in: [...remaining] } },
      select: { id: true, parentId: true },
    });
    const leaves = rows
      .filter((row) => !rows.some((other) => other.parentId === row.id))
      .map((row) => row.id);
    if (leaves.length === 0) break;
    await prisma.mediaFolder.deleteMany({ where: { id: { in: leaves } } });
    for (const id of leaves) remaining.delete(id);
  }
  await closeApp();
});

function trackFolder(dto: FolderDto): FolderDto {
  createdFolderIds.push(dto.id);
  return dto;
}

async function createFolder(name: string, parentId?: string | null): Promise<{ statusCode: number; body: FolderDto & { error?: string } }> {
  const res = await authInject(superAdminToken, {
    method: 'POST',
    url: '/api/media/folders',
    payload: { name, parentId: parentId ?? null },
  });
  return { statusCode: res.statusCode, body: res.json() as FolderDto & { error?: string } };
}

async function patchFolder(
  id: string,
  payload: { name?: string; parentId?: string | null }
): Promise<{ statusCode: number; body: FolderDto & { error?: string } }> {
  const res = await authInject(superAdminToken, {
    method: 'PATCH',
    url: `/api/media/folders/${id}`,
    payload,
  });
  return { statusCode: res.statusCode, body: res.json() as FolderDto & { error?: string } };
}

async function deleteFolder(id: string): Promise<{ statusCode: number; body: DeleteResult & { error?: string } }> {
  const res = await authInject(superAdminToken, { method: 'DELETE', url: `/api/media/folders/${id}` });
  return { statusCode: res.statusCode, body: res.json() as DeleteResult & { error?: string } };
}

async function move(ids: string[], folderId: string | null): Promise<{ statusCode: number; body: MoveResult & { error?: string } }> {
  const res = await authInject(superAdminToken, {
    method: 'POST',
    url: '/api/media/move',
    payload: { ids, folderId },
  });
  return { statusCode: res.statusCode, body: res.json() as MoveResult & { error?: string } };
}

let mediaSeq = 0;
/** A MediaFile row without anything on disk: the folder endpoints only move rows. */
async function createMediaRow(folderId: string | null, urlHint?: string): Promise<{ id: string }> {
  mediaSeq += 1;
  const row = await prisma.mediaFile.create({
    data: {
      url: `/uploads/folder-test-${Date.now()}-${mediaSeq}-${urlHint ?? 'x'}.webp`,
      filename: `folder-test-${mediaSeq}.webp`,
      originalName: `folder-test-${mediaSeq}.webp`,
      mimeType: 'image/webp',
      fileType: 'image',
      size: 100 + mediaSeq,
      storageKey: `folder-test-${mediaSeq}.webp`,
      folderId,
    },
  });
  createdMediaIds.push(row.id);
  return { id: row.id };
}

async function listFolders(): Promise<FolderDto[]> {
  const res = await authInject(superAdminToken, { method: 'GET', url: '/api/media/folders' });
  expect(res.statusCode).toBe(200);
  return (res.json() as { folders: FolderDto[] }).folders;
}

describe('Library folders: create, list, nest', () => {
  it('creates a root folder and a nested one and returns them with fileCount', async () => {
    const rootRes = await createFolder('مجلد الصور');
    expect(rootRes.statusCode).toBe(201);
    const root = trackFolder(rootRes.body);
    expect(root.name).toBe('مجلد الصور');
    expect(root.parentId).toBeNull();
    expect(root.fileCount).toBe(0);

    const childRes = await createFolder('2026', root.id);
    expect(childRes.statusCode).toBe(201);
    const child = trackFolder(childRes.body);
    expect(child.parentId).toBe(root.id);

    const list = await listFolders();
    const listedRoot = list.find((f) => f.id === root.id);
    const listedChild = list.find((f) => f.id === child.id);
    expect(listedRoot).toBeDefined();
    expect(listedChild).toBeDefined();
    expect(listedRoot?.fileCount).toBe(0);
  });

  it('rejects duplicate names case-insensitively within the same parent (409)', async () => {
    const rootRes = await createFolder('Unique Root');
    expect(rootRes.statusCode).toBe(201);
    expect(rootRes.body.name).toBe('Unique Root');
    trackFolder(rootRes.body);

    const dup = await createFolder('unique root');
    expect(dup.statusCode).toBe(409);
    expect(dup.body.error).toBe('A folder with this name already exists here');

    // The same name is fine under a different parent.
    const other = trackFolder((await createFolder('Outer')).body);
    const siblingRes = await createFolder('unique root', other.id);
    expect(siblingRes.statusCode).toBe(201);
    trackFolder(siblingRes.body);

    // ...and a duplicate child name under the same parent clashes too.
    const dupChild = await createFolder('UNIQUE ROOT', other.id);
    expect(dupChild.statusCode).toBe(409);
  });

  it('rejects invalid names with a 400', async () => {
    expect((await createFolder('')).statusCode).toBe(400);
    expect((await createFolder('   ')).statusCode).toBe(400);
    expect((await createFolder('a/b')).statusCode).toBe(400);
    expect((await createFolder('a\\b')).statusCode).toBe(400);
    expect((await createFolder('.')).statusCode).toBe(400);
    expect((await createFolder('..')).statusCode).toBe(400);
  });

  it('rejects creating a folder under a missing parent with 404', async () => {
    const res = await createFolder('orphan', '00000000-0000-4000-8000-000000000000');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Folder not found');
  });

  it('blocks nesting deeper than 5 levels (400)', async () => {
    let parent: FolderDto | undefined;
    const chain: FolderDto[] = [];
    for (let level = 1; level <= 5; level++) {
      const res = await createFolder(`depth-${level}`, parent?.id ?? null);
      expect(res.statusCode).toBe(201);
      parent = trackFolder(res.body);
      chain.push(parent);
    }
    const tooDeep = await createFolder('depth-6', parent?.id);
    expect(tooDeep.statusCode).toBe(400);
    expect(tooDeep.body.error).toBe('Folders can be nested at most 5 levels');
  });
});

describe('Library folders: rename and move', () => {
  it('renames a folder', async () => {
    const folder = trackFolder((await createFolder('old name')).body);
    const res = await patchFolder(folder.id, { name: 'new name' });
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('new name');
  });

  it('rejects a rename onto a sibling name case-insensitively (409)', async () => {
    const first = trackFolder((await createFolder('sibling a')).body);
    const second = trackFolder((await createFolder('sibling b')).body);
    const res = await patchFolder(second.id, { name: 'SIBLING A' });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('A folder with this name already exists here');
    expect(first.id).not.toBe(second.id);
  });

  it('answers 400 when neither name nor parentId is given', async () => {
    const folder = trackFolder((await createFolder('no-change')).body);
    const res = await authInject(superAdminToken, {
      method: 'PATCH',
      url: `/api/media/folders/${folder.id}`,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('moves a folder to another parent', async () => {
    const source = trackFolder((await createFolder('move-src')).body);
    const target = trackFolder((await createFolder('move-dst')).body);
    const res = await patchFolder(source.id, { parentId: target.id });
    expect(res.statusCode).toBe(200);
    expect(res.body.parentId).toBe(target.id);
  });

  it('refuses to move a folder into itself and into a descendant (400)', async () => {
    const parent = trackFolder((await createFolder('self-test-parent')).body);
    const child = trackFolder((await createFolder('self-test-child', parent.id)).body);

    const intoSelf = await patchFolder(parent.id, { parentId: parent.id });
    expect(intoSelf.statusCode).toBe(400);
    expect(intoSelf.body.error).toBe('Cannot move a folder into itself');

    const intoChild = await patchFolder(parent.id, { parentId: child.id });
    expect(intoChild.statusCode).toBe(400);
    expect(intoChild.body.error).toBe('Cannot move a folder into itself');
  });

  it('refuses a move onto a name the destination already holds (409)', async () => {
    const parent = trackFolder((await createFolder('clash-src')).body);
    const child = trackFolder((await createFolder('twin', parent.id)).body);
    const holder = trackFolder((await createFolder('clash-dst')).body);
    const twin = trackFolder((await createFolder('twin', holder.id)).body);
    expect(twin.id).not.toBe(child.id);

    const res = await patchFolder(child.id, { parentId: holder.id });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('A folder with this name already exists here');
  });

  it('renames a child folder when deleting its parent frees it into a name clash', async () => {
    const root = trackFolder((await createFolder('clash-del-root')).body);
    const doomed = trackFolder((await createFolder('clash-del-parent', root.id)).body);
    const movedChild = trackFolder((await createFolder('clash-twin', doomed.id)).body);
    const holder = trackFolder((await createFolder('clash-twin', root.id)).body);
    expect(holder.id).not.toBe(movedChild.id);

    const res = await deleteFolder(doomed.id);
    expect(res.statusCode).toBe(200);
    expect(res.body.movedFolders).toBe(1);

    const survivor = await prisma.mediaFolder.findUnique({ where: { id: movedChild.id } });
    expect(survivor?.parentId).toBe(root.id);
    expect(survivor?.name).toBe('clash-twin (2)');
  });
});

describe('Library folders: moving files', () => {
  it('moves files into a folder, back to the root, and 404s on a missing folder', async () => {
    const folder = trackFolder((await createFolder('file-target')).body);
    const a = await createMediaRow(null);
    const b = await createMediaRow(null);

    const into = await move([a.id, b.id], folder.id);
    expect(into.statusCode).toBe(200);
    expect(into.body.moved).toBe(2);

    const rows = await prisma.mediaFile.findMany({ where: { id: { in: [a.id, b.id] } } });
    expect(rows.every((row) => row.folderId === folder.id)).toBe(true);

    const toRoot = await move([a.id], null);
    expect(toRoot.statusCode).toBe(200);
    expect(toRoot.body.moved).toBe(1);
    expect((await prisma.mediaFile.findUnique({ where: { id: a.id } }))?.folderId).toBeNull();

    const missing = await move([a.id], '00000000-0000-4000-8000-000000000000');
    expect(missing.statusCode).toBe(404);
    expect(missing.body.error).toBe('Folder not found');
  });

  it('counts the files directly inside a folder (fileCount)', async () => {
    const folder = trackFolder((await createFolder('counted')).body);
    const one = await createMediaRow(null);
    const two = await createMediaRow(null);
    expect((await move([one.id, two.id], folder.id)).body.moved).toBe(2);

    const listed = (await listFolders()).find((f) => f.id === folder.id);
    expect(listed?.fileCount).toBe(2);
  });
});

describe('Library folders: deleting keeps every file', () => {
  it('moves files and child folders up one level and keeps every file row', async () => {
    const root = trackFolder((await createFolder('doom-root')).body);
    const child = trackFolder((await createFolder('doom-child', root.id)).body);
    const grandChild = trackFolder((await createFolder('doom-grandchild', child.id)).body);

    const inRoot = await createMediaRow(root.id);
    const inChild = await createMediaRow(child.id);

    const res = await deleteFolder(child.id);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.movedFiles).toBe(1);
    expect(res.body.movedFolders).toBe(1);

    expect(await prisma.mediaFile.findUnique({ where: { id: inRoot.id } })).not.toBeNull();
    const survivor = await prisma.mediaFile.findUnique({ where: { id: inChild.id } });
    expect(survivor).not.toBeNull();
    expect(survivor?.folderId).toBe(root.id); // moved up one level, not deleted

    const movedChild = await prisma.mediaFolder.findUnique({ where: { id: grandChild.id } });
    expect(movedChild?.parentId).toBe(root.id); // grandchild moved up with the delete

    expect(await prisma.mediaFolder.findUnique({ where: { id: child.id } })).toBeNull();

    // Tidy the remaining subtree before the shared afterAll cleanup.
    await deleteFolder(grandChild.id);
    const finalDelete = await deleteFolder(root.id);
    expect(finalDelete.statusCode).toBe(200);
    expect(finalDelete.body.movedFiles).toBe(2);
  });

  it('answers 404 when deleting a missing folder', async () => {
    const res = await deleteFolder('00000000-0000-4000-8000-000000000000');
    expect(res.statusCode).toBe(404);
  });
});

describe('Library list: folder query', () => {
  it('filters GET /api/media by root, by folder id and with folder=all', async () => {
    const folder = trackFolder((await createFolder('list-filter')).body);
    const inside = await createMediaRow(folder.id);
    const atRoot = await createMediaRow(null);

    const list = async (query: string) => {
      const res = await authInject(superAdminToken, { method: 'GET', url: `/api/media?${query}` });
      expect(res.statusCode).toBe(200);
      return res.json() as { items: Array<{ id: string; folderId: string | null }>; total: number };
    };

    const inFolder = await list(`folder=${folder.id}&limit=100`);
    expect(inFolder.total).toBe(1);
    expect(inFolder.items.map((item) => item.id)).toContain(inside.id);
    expect(inFolder.items[0].folderId).toBe(folder.id);

    const rootOnly = await list('folder=root&limit=100');
    expect(rootOnly.items.some((item) => item.id === atRoot.id)).toBe(true);
    expect(rootOnly.items.some((item) => item.id === inside.id)).toBe(false);

    const everything = await list('folder=all&limit=100');
    expect(everything.items.some((item) => item.id === inside.id)).toBe(true);
    expect(everything.items.some((item) => item.id === atRoot.id)).toBe(true);

    // Without the parameter nothing changes for the media picker.
    const picker = await list('limit=100');
    expect(picker.items.some((item) => item.id === inside.id)).toBe(true);

    // An unknown folder id is an empty page, not an error.
    const unknown = await list('folder=00000000-0000-4000-8000-000000000000');
    expect(unknown.total).toBe(0);
    expect(unknown.items).toHaveLength(0);

    // The status filter keeps working together with the folder filter.
    const linkedInFolder = await list(`folder=${folder.id}&status=linked&limit=100`);
    expect(linkedInFolder.total).toBe(0);
  });
});
