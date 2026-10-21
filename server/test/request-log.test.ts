import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loggerService } from '../src/services/loggerService.js';
import { closeApp, getApp, inject } from './helpers.js';

/**
 * The request log is copied around, shipped and read by people who are not
 * the ones who sent the request. A query string is where keys, tokens, OTPs
 * and passwords travel, so it must never reach the log.
 *
 * Two logs are checked: the one this application writes itself
 * (`loggerService`) and the one Fastify writes for every request.
 */

const MARKER = 'leak-marker-8f21c4';

const written: string[] = [];
const logStream = {
  write(message: string) {
    written.push(message);
  },
};

let app: FastifyInstance;

beforeAll(async () => {
  // The stream is only used when the app is built, so the first call wins.
  app = await getApp(logStream);
});

afterAll(async () => {
  await closeApp();
});

function httpEntries(): Array<{ message: string; context?: Record<string, unknown> }> {
  return loggerService
    .getLogs({ source: 'buffer', limit: 1000 })
    .entries.filter((entry) => entry.source === 'http');
}

describe('the request log of the application', () => {
  it('records the path without the query string', async () => {
    const response = await inject({
      method: 'GET',
      url: `/api/request-log-probe?token=${MARKER}&password=hunter2&otp=123456&key=abc`,
    });
    expect(response.statusCode).toBe(404);

    const entries = httpEntries();
    const logged = entries.find((entry) => entry.message.includes('/api/request-log-probe'));

    expect(logged).toBeDefined();
    expect(logged?.message).toMatch(/^GET \/api\/request-log-probe - 404/);
    expect(logged?.message).not.toContain('?');
  });

  it('never records a query parameter', async () => {
    await inject({
      method: 'GET',
      url: `/api/request-log-probe?token=${MARKER}&password=hunter2&otp=123456&key=abc`,
    });

    const serialised = JSON.stringify(httpEntries());

    expect(serialised).not.toContain(MARKER);
    expect(serialised).not.toContain('hunter2');
    expect(serialised).not.toContain('123456');
  });
});

describe('the request log of the server', () => {
  it('never writes a query parameter', async () => {
    written.length = 0;
    app.log.level = 'info';

    await inject({
      method: 'GET',
      url: `/api/request-log-probe?token=${MARKER}&password=hunter2&otp=123456&key=abc`,
    });

    app.log.level = 'silent';

    const output = written.join('');
    expect(output).toContain('/api/request-log-probe');
    expect(output).not.toContain(MARKER);
    expect(output).not.toContain('hunter2');
    expect(output).not.toContain('123456');
  });
});
