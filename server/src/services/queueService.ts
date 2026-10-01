import { Queue, Worker, type ConnectionOptions } from 'bullmq';
// Named import: ioredis is a CommonJS package, so under NodeNext the default
// import resolves to the module namespace rather than the `Redis` class.
import { Redis } from 'ioredis';
import { config } from '../config/env.js';
import { loggerService } from './loggerService.js';

/**
 * A unit of deferred work. `name` is the BullMQ job name, so the worker can map
 * a queued payload back to the exact handler that produced it.
 */
export interface QueueableJob<T = unknown> {
  name: string;
  handle(payload: T): Promise<void>;
}

export type QueueDriver = 'redis' | 'sync';

/** BullMQ queue name shared by the enqueuer and the in-process worker. */
const QUEUE_NAME = 'ajda-jobs';

/**
 * Probing a dead Redis costs up to this long, and the probe runs once on boot.
 * Keeps a missing Redis from stalling startup, which is the whole point of the
 * fallback.
 */
const PROBE_TIMEOUT_MS = 1500;

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

/**
 * BullMQ requires a connection that can be reused across the queue, worker and
 * blocking operations, so every client is built from this one factory rather
 * than sharing a single instance.
 */
function connectionOptions(): ConnectionOptions {
  return { url: config.queue.redisUrl } as ConnectionOptions;
}

let mode: QueueDriver = 'sync';
let queue: Queue | undefined;
let worker: Worker | undefined;
let clients: Redis[] = [];
let initialized = false;

/**
 * Creates a Redis client that fails fast and never retries on its own.
 *
 * `lazyConnect` means the socket is not opened until the first command, so an
 * unreachable Redis surfaces as a rejected `ping()` we can catch, instead of an
 * unhandled `error` event that would take the process down.
 */
function createProbeClient(): Redis {
  const client = new Redis(config.queue.redisUrl, {
    connectTimeout: PROBE_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy: () => null,
  });
  // Without a listener ioredis turns connection errors into uncaught exceptions.
  client.on('error', () => {});
  return client;
}

async function probeRedis(): Promise<boolean> {
  const probe = createProbeClient();
  try {
    await probe.connect();
    const reply = await probe.ping();
    return reply === 'PONG';
  } catch {
    return false;
  } finally {
    probe.disconnect();
  }
}

export function queueDriver(): QueueDriver {
  return mode;
}

export function isQueueReady(): boolean {
  return initialized;
}

/**
 * Brings up the queue. Safe to call more than once.
 *
 * `QUEUE_DRIVER=sync` skips the probe entirely; `auto` degrades to inline
 * execution when Redis is unreachable. `redis` throws instead, so a staging or
 * production deployment cannot silently run without its worker.
 */
export async function initQueueService(): Promise<void> {
  if (initialized) return;

  if (config.queue.driver === 'sync') {
    mode = 'sync';
    initialized = true;
    loggerService.info('[queue] QUEUE_DRIVER=sync — running jobs inline (Redis disabled).', {}, 'queue');
    return;
  }

  const reachable = await probeRedis();

  if (!reachable) {
    if (config.queue.driver === 'redis') {
      throw new Error(
        `[queue] QUEUE_DRIVER=redis but Redis is unreachable at ${config.queue.redisUrl}. ` +
          'Start Redis or set QUEUE_DRIVER=auto to allow the synchronous fallback.'
      );
    }
    mode = 'sync';
    initialized = true;
    loggerService.info(
      '[queue] Redis unavailable — operating in synchronous (sync) fallback mode.',
      { redisUrl: config.queue.redisUrl },
      'queue'
    );
    return;
  }

  const queueConnection = new Redis(config.queue.redisUrl, { maxRetriesPerRequest: null });
  const workerConnection = new Redis(config.queue.redisUrl, { maxRetriesPerRequest: null });
  queueConnection.on('error', (err: Error) => {
    loggerService.error('[queue] Redis connection error', { err: err.message }, 'queue');
  });
  workerConnection.on('error', (err: Error) => {
    loggerService.error('[queue] Redis worker connection error', { err: err.message }, 'queue');
  });
  clients = [queueConnection, workerConnection];

  queue = new Queue(QUEUE_NAME, { connection: connectionOptions() });
  worker = new Worker(
    QUEUE_NAME,
    async (bullJob) => {
      const handler = handlers.get(bullJob.name);
      if (!handler) {
        throw new Error(`[queue] no handler registered for job "${bullJob.name}"`);
      }
      await handler(bullJob.data as unknown);
    },
    { connection: connectionOptions() }
  );

  worker.on('completed', (job) => {
    loggerService.info(`[queue] job "${job.name}" completed`, { jobId: job.id }, 'queue');
  });

  worker.on('failed', (job, err) => {
    const attemptsMade = job?.attemptsMade ?? 0;
    const context = { jobName: job?.name, jobId: job?.id, attemptsMade, err: err.message };
    // Only the final attempt is a genuine loss; intermediates are the backoff
    // working as designed, so they stay at warn level and out of errors.log.
    if (attemptsMade >= (job?.opts?.attempts ?? 1)) {
      loggerService.error(`[queue] job "${job?.name}" failed after ${attemptsMade} attempts`, context, 'queue');
    } else {
      loggerService.warn(`[queue] job "${job?.name}" attempt ${attemptsMade} failed, will retry`, context, 'queue');
    }
  });

  worker.on('error', (err) => {
    loggerService.error('[queue] worker error', { err: err.message }, 'queue');
  });

  mode = 'redis';
  initialized = true;
  loggerService.info('[queue] Redis connected — jobs dispatched asynchronously.', { queue: QUEUE_NAME }, 'queue');
}

/**
 * Job name -> handler, registered by the jobs that dispatch them.
 *
 * The worker runs in-process, so it needs its own map rather than the
 * `QueueableJob` objects the routes hold. Keys are `QueueableJob.name`, which
 * keeps the queue payload free of function references (they cannot be
 * serialised into Redis).
 */
const handlers = new Map<string, (payload: unknown) => Promise<void>>();

/** Registers a job so the worker can execute it after a restart. */
export function registerJob<T>(job: QueueableJob<T>): void {
  handlers.set(job.name, (payload: unknown) => job.handle(payload as T));
}

/**
 * Runs `job.handle(payload)` now, swallowing failures.
 *
 * `sendMail` already swallows its own errors, so this only guards the job body
 * itself. A failing notification must never fail the caller's request.
 */
async function runInline<T>(job: QueueableJob<T>, payload: T): Promise<void> {
  try {
    await job.handle(payload);
  } catch (error) {
    loggerService.error(
      `[queue] job "${job.name}" failed in synchronous fallback mode`,
      { err: error instanceof Error ? error.message : String(error) },
      'queue'
    );
  }
}

/**
 * Hands a job to the queue, or runs it inline when Redis is unavailable.
 *
 * In Redis mode this only writes to Redis, so the HTTP response is not held up
 * by the SMTP handshake. A Redis failure discovered at dispatch time degrades to
 * inline execution for that job rather than losing it.
 */
export async function dispatch<T>(job: QueueableJob<T>, payload: T): Promise<void> {
  if (mode !== 'redis' || !queue) {
    await runInline(job, payload);
    return;
  }

  try {
    await queue.add(job.name, payload, JOB_OPTIONS);
  } catch (error) {
    loggerService.warn(
      `[queue] enqueue failed for "${job.name}", running inline instead`,
      { err: error instanceof Error ? error.message : String(error) },
      'queue'
    );
    await runInline(job, payload);
  }
}

/** Closes the worker, the queue and every Redis client. Safe to call twice. */
export async function closeQueueService(): Promise<void> {
  const closing = [worker?.close(), queue?.close()].filter(
    (promise): promise is Promise<void> => Boolean(promise)
  );

  await Promise.allSettled(closing);
  for (const client of clients) {
    client.disconnect();
  }

  clients = [];
  worker = undefined;
  queue = undefined;
  mode = 'sync';
  initialized = false;
}
