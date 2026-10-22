import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeApp, getApp, inject } from './helpers.js';

/**
 * The security headers Helmet adds.
 *
 * Two of them are deliberate choices: no Content-Security-Policy (the API
 * serves JSON and the SPA lives on another origin, so a policy that was never
 * tested against the real pages would break them) and no
 * Strict-Transport-Security outside production (it is only correct on a real
 * HTTPS deployment).
 */

beforeAll(async () => {
  await getApp();
});

afterAll(async () => {
  await closeApp();
});

describe('the security headers', () => {
  it('sets the standard hardening headers', async () => {
    const response = await inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('does not send a Content-Security-Policy', async () => {
    const response = await inject({ method: 'GET', url: '/api/health' });

    expect(response.headers['content-security-policy']).toBeUndefined();
  });

  it('does not send Strict-Transport-Security outside production', async () => {
    const response = await inject({ method: 'GET', url: '/api/health' });

    expect(response.headers['strict-transport-security']).toBeUndefined();
  });
});

describe('the not-found handler', () => {
  it('answers without echoing the query string', async () => {
    const response = await inject({ method: 'GET', url: '/api/does-not-exist?key=a-secret-key' });

    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain('a-secret-key');
    expect(response.body).toContain('/api/does-not-exist');
  });

  it('does not break the CORS preflight of an unknown route', async () => {
    const response = await inject({
      method: 'OPTIONS',
      url: '/api/does-not-exist',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
