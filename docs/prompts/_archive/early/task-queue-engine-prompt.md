# 📋 Task Brief for OpenCode: Asynchronous Job Queue (BullMQ + Redis with Automatic Sync Fallback)

> **Assigned to**: OpenCode  
> **Platform Version**: 1.2.1  
> **Module**: Backend Queue & Mail Dispatching (`server/`)  
> **Target Branch**: `feat/opencode-worker`

---

## 🎯 Objective

Currently, submitting customer inquiries or developer feedback notes executes `await sendMail(...)` synchronously during the HTTP request. Because connecting to Google's SMTP servers (`smtp.gmail.com:587`) requires TLS handshakes, authentication, and acknowledgment, the browser is forced to wait **3 to 6 seconds** before receiving an HTTP response.

Your task is to implement an **Asynchronous Job Queue Engine** modeled after Laravel's `Queueable` pattern:
1. **High Performance**: When Redis is available, jobs are pushed to BullMQ in **<2ms**, allowing the HTTP endpoint to return **`201 Created` in under 30ms**.
2. **Zero-Crash Sync Fallback**: If Redis is not running or unreachable, the queue manager must **automatically degrade to synchronous inline execution (`sync`)** without throwing unhandled errors, ensuring emails are never lost in dev environments without Redis.

---

## 🛠️ Step-by-Step Requirements

### 1. Install Dependencies in `server/`
Navigate to `server/` and install `bullmq` and `ioredis`:
```bash
npm install bullmq ioredis
npm install --save-dev @types/ioredis
```

---

### 2. Environment Configuration in `server/src/config/env.ts`
Add the queue configuration to Zod `envSchema` and export in `config`:
```ts
// In envSchema:
REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
QUEUE_DRIVER: z.enum(['auto', 'redis', 'sync']).default('auto'),

// In exported config:
queue: {
  redisUrl: env.REDIS_URL,
  driver: env.QUEUE_DRIVER,
},
```
Also update `server/.env.example` with these defaults.

---

### 3. Queue Manager & Worker (`server/src/services/queueService.ts`)

Implement `QueueService` adhering to the following design:

```ts
export interface QueueableJob<T = unknown> {
  name: string;
  handle(payload: T): Promise<void>;
}
```

#### Key Behaviors:
- **Connection Probing**:
  - Probe Redis with a short connection timeout (e.g. 1500ms) on startup.
  - If connection succeeds and `QUEUE_DRIVER !== 'sync'`:
    - Initialize BullMQ `Queue` and `Worker` (`ajda-jobs`).
    - Mark status as `active` (`driver = 'redis'`).
  - If Redis fails or is unreachable:
    - Log an informational message: `[queue] Redis unavailable — operating in synchronous (sync) fallback mode.`
    - Mark status as `fallback` (`driver = 'sync'`).
- **`dispatch(job: QueueableJob<T>, payload: T): Promise<void>`**:
  - If in Redis mode:
    ```ts
    await this.bullQueue.add(job.name, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
    ```
  - If in `sync` mode:
    ```ts
    await job.handle(payload);
    ```
- **Error Handling**:
  - In BullMQ worker `failed` event:
    Log to `loggerService.error(...)` (which automatically persists to `server/errors.log`).
- **Graceful Shutdown**:
  - Provide a `close()` method to cleanly close Redis connections on server shutdown (`SIGTERM` / `SIGINT`).

---

### 4. Create Concrete Queue Jobs (`server/src/jobs/`)

Create `server/src/jobs/emailJobs.ts`:

1. **`SendDeveloperNoteEmailJob`**:
   - Payload:
     ```ts
     export interface DeveloperNoteMailPayload {
       noteId: string;
       title: string;
       section: string;
       body: string;
       solution?: string | null;
       screenshotUrl?: string | null;
       adminName?: string | null;
       adminEmail?: string | null;
       priority: string;
     }
     ```
   - Execution: Iterates over `config.developer.emails` and calls `sendMail()` using `developerNoteNotification(...)`.

2. **`SendInquiryNotificationJob`**:
   - Payload: Customer inquiry details (`projectTitle`, `unitNumber`, `name`, `phone`, `email`, `notes`).
   - Execution: Calls `sendMail()` for inquiry notifications.

---

### 5. Wire Route Endpoints

1. **In `server/src/routes/developerNotes.routes.ts`**:
   - Replace the inline `for (const recipient of recipients) { await sendMail(...) }` loop with:
     ```ts
     await queueService.dispatch(sendDeveloperNoteEmailJob, {
       noteId: note.id,
       title: note.title,
       section: note.section,
       body: note.body,
       solution: note.solution,
       screenshotUrl: note.screenshotUrl,
       adminName: note.adminName,
       adminEmail: note.adminEmail,
       priority: note.priority,
     });
     ```
2. **In `server/src/routes/inquiries.routes.ts`**:
   - Wire public customer inquiry submission to dispatch `sendInquiryNotificationJob`.

---

### 6. Quality Gates & Verification Checklist

Before reporting completion, verify:
- [ ] `npx tsc -p server/tsconfig.json --noEmit` → **0 errors**.
- [ ] `npm run lint` → **0 errors**.
- [ ] When Redis is **NOT running**:
  - Starting the server logs the fallback message cleanly.
  - Submitting a developer note completes via `sync` and sends the email without crashing.
- [ ] When Redis **IS running**:
  - Submitting a developer note returns `201 Created` in **<30ms**, while the worker processes the email in the background.
