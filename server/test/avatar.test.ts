import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authInject,
  buildMultipartBody,
  closeApp,
  getApp,
  inject,
  seedSession,
} from './helpers.js';

let userToken: string;

beforeAll(async () => {
  await getApp();
  userToken = (await seedSession('admin@ajdaa.sa')).token;
});

afterAll(async () => {
  await closeApp();
});

describe('User avatar endpoints', () => {
  it('rejects unauthenticated requests to avatar endpoints', async () => {
    const postRes = await inject({
      method: 'POST',
      url: '/api/auth/me/avatar',
    });
    expect(postRes.statusCode).toBe(401);

    const deleteRes = await inject({
      method: 'DELETE',
      url: '/api/auth/me/avatar',
    });
    expect(deleteRes.statusCode).toBe(401);
  });

  it('uploads an avatar image, updates current user, and allows deleting it', async () => {
    const png = await sharp({
      create: { width: 48, height: 48, channels: 3, background: { r: 20, g: 80, b: 160 } },
    })
      .png()
      .toBuffer();

    const { payload, headers } = buildMultipartBody({
      filename: 'my-avatar.png',
      contentType: 'image/png',
      data: png,
    });

    const uploadRes = await authInject(userToken, {
      method: 'POST',
      url: '/api/auth/me/avatar',
      payload,
      headers,
    });

    expect(uploadRes.statusCode).toBe(200);
    const body = uploadRes.json() as { avatar: string; user: { avatar: string | null } };
    expect(body.avatar).toBeTruthy();
    expect(body.user.avatar).toBe(body.avatar);

    // Verify GET /api/auth/me reflects the new avatar
    const meRes = await authInject(userToken, {
      method: 'GET',
      url: '/api/auth/me',
    });
    expect(meRes.statusCode).toBe(200);
    expect((meRes.json() as { user: { avatar: string | null } }).user.avatar).toBe(body.avatar);

    // Delete avatar
    const deleteRes = await authInject(userToken, {
      method: 'DELETE',
      url: '/api/auth/me/avatar',
    });
    expect(deleteRes.statusCode).toBe(200);
    const delBody = deleteRes.json() as { success: boolean; user: { avatar: string | null } };
    expect(delBody.success).toBe(true);
    expect(delBody.user.avatar).toBeNull();

    // Verify GET /api/auth/me reflects the deletion
    const meAfterDelete = await authInject(userToken, {
      method: 'GET',
      url: '/api/auth/me',
    });
    expect(meAfterDelete.statusCode).toBe(200);
    expect((meAfterDelete.json() as { user: { avatar: string | null } }).user.avatar).toBeNull();
  });

  it('rejects non-image files such as PDF with 400', async () => {
    const { payload, headers } = buildMultipartBody({
      filename: 'document.pdf',
      contentType: 'application/pdf',
      data: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n', 'utf8'),
    });

    const res = await authInject(userToken, {
      method: 'POST',
      url: '/api/auth/me/avatar',
      payload,
      headers,
    });

    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toContain('Only image files');
  });
});
