import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { config } from '../src/config/env.js';
import { authInject, closeApp, getApp, inject, seedSession, SEED_ADMINS, type TestSession } from './helpers.js';

/**
 * The admin session is a signed JWT: it must reject forged and expired tokens
 * whatever the JWT library does by default, and the public uploads route must
 * not serve files outside the upload directory.
 */

let session: TestSession;

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

beforeAll(async () => {
  await getApp();
  session = await seedSession(SEED_ADMINS.superAdmin);
});

afterAll(async () => {
  await closeApp();
});

describe('admin token verification', () => {
  it('accepts a freshly signed token', async () => {
    const response = await authInject(session.token, { method: 'GET', url: '/api/auth/me' });
    expect(response.statusCode).toBe(200);
  });

  it('rejects an unsigned token that claims alg none', async () => {
    const forged = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ id: session.id, email: session.email, role: 'super_admin' })}.`;
    const response = await authInject(forged, { method: 'GET', url: '/api/auth/me' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects a token signed with another secret', async () => {
    const app = await getApp();
    // Same payload and algorithm, but a signature the server cannot have made.
    const [header, payload] = app.jwt.sign({ id: session.id, email: session.email, role: 'super_admin' }).split('.');
    const response = await authInject(`${header}.${payload}.${'A'.repeat(43)}`, { method: 'GET', url: '/api/auth/me' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects an expired token', async () => {
    const app = await getApp();
    const now = Math.floor(Date.now() / 1000);
    const expired = app.jwt.sign({ id: session.id, email: session.email, role: 'super_admin', iat: now - 7200 }, { expiresIn: '1h' });
    const response = await authInject(expired, { method: 'GET', url: '/api/auth/me' });
    expect(response.statusCode).toBe(401);
  });
});

describe('uploads route', () => {
  it('does not serve files outside the upload directory or list directories', async () => {
    for (const url of ['/uploads/..%2f..%2fpackage.json', '/uploads/../package.json', '/uploads/', '/uploads/%2e%2e/package.json']) {
      const response = await inject({ method: 'GET', url });
      expect([400, 403, 404]).toContain(response.statusCode);
      expect(response.body).not.toContain('"name"');
    }
  });
});

describe('serving uploads', () => {
  it('serves an uploaded file with nosniff and sends a PDF as an attachment', async () => {
    fs.mkdirSync(config.uploadDir, { recursive: true });
    const image = 'token-hardening-test.webp';
    const pdf = 'token-hardening-test.pdf';
    fs.writeFileSync(path.join(config.uploadDir, image), 'not really an image');
    fs.writeFileSync(path.join(config.uploadDir, pdf), '%PDF-1.4 test');

    try {
      const imageResponse = await inject({ method: 'GET', url: `/uploads/${image}` });
      expect(imageResponse.statusCode).toBe(200);
      expect(imageResponse.headers['x-content-type-options']).toBe('nosniff');

      const pdfResponse = await inject({ method: 'GET', url: `/uploads/${pdf}` });
      expect(pdfResponse.statusCode).toBe(200);
      expect(pdfResponse.headers['content-disposition']).toBe('attachment');
    } finally {
      fs.rmSync(path.join(config.uploadDir, image), { force: true });
      fs.rmSync(path.join(config.uploadDir, pdf), { force: true });
    }
  });
});
