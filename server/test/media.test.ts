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

let superAdminToken: string;

beforeAll(async () => {
  await getApp();
  superAdminToken = (await seedSession('admin@ajdaa.sa')).token;
});

afterAll(async () => {
  await closeApp();
});

async function upload(file: { filename: string; contentType: string; data: Buffer }) {
  const { payload, headers } = buildMultipartBody(file);
  return authInject(superAdminToken, {
    method: 'POST',
    url: '/api/media/upload',
    payload,
    headers,
  });
}

describe('uploaded files are stored under a type the client cannot choose', () => {
  it('forces a .pdf extension on a PDF sent under a dangerous filename', async () => {
    // The declared mimetype and the extension are both attacker-controlled, so
    // the decision has to come from the file signature.
    const response = await upload({
      filename: 'evil.html',
      contentType: 'text/html',
      data: Buffer.from('%PDF-1.4\n<html><script>alert(1)</script></html>\n', 'utf8'),
    });

    expect(response.statusCode).toBe(201);

    const { url } = response.json() as { url: string; filename: string };
    expect(url.endsWith('-evil.pdf')).toBe(true);

    const fetched = await inject({ method: 'GET', url });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.headers['content-type']).toContain('application/pdf');
    // Never rendered inline on our own origin.
    expect(fetched.headers['content-disposition']).toBe('attachment');
    expect(fetched.headers['x-content-type-options']).toBe('nosniff');
  });

  it('re-encodes a real PNG to webp', async () => {
    const png = await sharp({
      create: { width: 32, height: 32, channels: 3, background: { r: 12, g: 34, b: 56 } },
    })
      .png()
      .toBuffer();

    const response = await upload({ filename: 'photo.png', contentType: 'image/png', data: png });

    expect(response.statusCode).toBe(201);

    const { url } = response.json() as { url: string; filename: string };
    expect(url.endsWith('.webp')).toBe(true);

    const fetched = await inject({ method: 'GET', url });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.headers['content-type']).toContain('image/webp');

    // And it really is a decodable webp, not a renamed original.
    const decoded = await sharp(fetched.rawPayload).metadata();
    expect(decoded.format).toBe('webp');
    expect(decoded.width).toBe(32);
  });
});

describe('unsupported uploads are rejected', () => {
  it('rejects a file that is neither an image nor a PDF', async () => {
    const response = await upload({
      filename: 'notes.txt',
      contentType: 'text/plain',
      data: Buffer.from('just some plain text, nothing to see here', 'utf8'),
    });

    expect(response.statusCode).toBe(400);
  });
});
