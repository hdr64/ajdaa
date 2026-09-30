import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config } from '../config/env.js';
import { loggerService } from '../services/loggerService.js';

const querySchema = z.object({
  key: z.string().optional(),
  level: z.enum(['all', 'error', 'warn', 'info', 'debug']).optional().default('all'),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
  source: z.enum(['buffer', 'file']).optional().default('buffer'),
});

/**
 * Authentication check for logs:
 * Allowed if:
 * 1. LOGS_PUBLIC is true, OR
 * 2. Request supplies valid secret key via query param `?key=...` or header `x-logs-key` or `Authorization: Bearer <key>`, OR
 * 3. Request comes from an authenticated AdminUser with `super_admin` role or `manageSettings` permission.
 */
function isAuthorized(request: FastifyRequest): boolean {
  if (config.logs.isPublic) {
    return true;
  }

  const queryKey = (request.query as { key?: string })?.key;
  const headerKey = request.headers['x-logs-key'] as string | undefined;
  const authHeader = request.headers['authorization'];
  let bearerKey: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerKey = authHeader.substring(7).trim();
  }

  const providedKey = queryKey || headerKey || bearerKey;
  if (providedKey && config.logs.secretKey && providedKey === config.logs.secretKey) {
    return true;
  }

  // Check if admin is authenticated via JWT
  const admin = request.admin;
  if (admin) {
    if (admin.role === 'super_admin' || admin.role === 'admin') {
      return true;
    }
  }

  return false;
}

export const logsRoutes: FastifyPluginAsync = async (fastify) => {
  // Guard middleware
  fastify.addHook('preHandler', async (request, reply) => {
    // Exempt client error telemetry beacon from authorization
    if (request.url.startsWith('/api/logs/client-error') || request.url.startsWith('/client-error')) {
      return;
    }

    // Try authenticating via JWT if present, but do not fail if unauthenticated
    try {
      await request.jwtVerify();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      request.admin = request.user as any;
    } catch {
      // Ignore JWT failure; proceed to key validation
    }

    if (!isAuthorized(request)) {
      return reply.status(401).send({
        error: 'Unauthorized access to production logs',
        message: 'Provide the secret key via ?key=... or x-logs-key header, or log in as an administrator.',
        hint: 'You can configure LOGS_SECRET_KEY or LOGS_PUBLIC=true in server/.env',
      });
    }
  });

  // 1. GET /api/logs - JSON API with filtering, pagination, and system telemetry
  fastify.get('/', async (request: FastifyRequest<{ Querystring: z.infer<typeof querySchema> }>) => {
    const query = querySchema.parse(request.query);
    const result = loggerService.getLogs({
      level: query.level,
      search: query.search,
      limit: query.limit,
      source: query.source,
    });

    return {
      success: true,
      query: {
        level: query.level,
        search: query.search || null,
        limit: query.limit,
        source: query.source,
      },
      ...result,
    };
  });

  // 2. GET /api/logs/raw - Plain text raw prod.log stream
  fastify.get('/raw', async (request, reply) => {
    const query = request.query as { lines?: string };
    const lines = parseInt(query.lines || '500', 10);
    const text = loggerService.getRawFileContent(isNaN(lines) ? 500 : lines);

    reply.header('Content-Type', 'text/plain; charset=utf-8');
    return text;
  });

  // 3. GET /api/logs/errors - Plain text raw errors.log stream
  fastify.get('/errors', async (request, reply) => {
    const query = request.query as { lines?: string };
    const lines = parseInt(query.lines || '500', 10);
    const text = loggerService.getRawErrorsFileContent(isNaN(lines) ? 500 : lines);

    reply.header('Content-Type', 'text/plain; charset=utf-8');
    return text;
  });

  // 4. POST /api/logs/errors/clear - Clear errors.log file
  fastify.post('/errors/clear', async () => {
    const result = loggerService.clearErrors();
    return {
      success: true,
      message: 'Errors log cleared successfully',
      ...result,
    };
  });

  // 5. POST /api/logs/client-error - Report frontend client-side error to errors.log
  const clientErrorSchema = z.object({
    message: z.string().trim().min(1).max(1000),
    source: z.string().trim().max(100).optional().default('frontend'),
    url: z.string().trim().max(1000).optional(),
    stack: z.string().trim().max(5000).optional(),
    context: z.record(z.unknown()).optional(),
  });

  fastify.post(
    '/client-error',
    {
      config: { rateLimit: { max: 60, timeWindow: 60_000 } },
    },
    async (request, reply) => {
      const parsed = clientErrorSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid error report payload' });
      }

      const { message, source, url, stack, context } = parsed.data;
      loggerService.error(
        `Client error reported: ${message}`,
        {
          url: url || request.headers.referer,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          stack,
          ...context,
        },
        source
      );

      return { success: true, recorded: true };
    }
  );

  // 6. GET /api/logs/stats - Telemetry stats only
  fastify.get('/stats', async () => {
    return {
      success: true,
      stats: loggerService.getStats(),
    };
  });

  // 7. POST /api/logs/clear - Clear logs (memory + file)
  fastify.post('/clear', async () => {
    const result = loggerService.clearLogs();
    return {
      success: true,
      message: 'Logs cleared successfully',
      ...result,
    };
  });

  // 5. GET /api/logs/view - Rich HTML interactive live log viewer
  fastify.get('/view', async (request, reply: FastifyReply) => {
    const query = request.query as { key?: string };
    const secretKey = query.key || config.logs.secretKey;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ajda Real Estate — Production Server Logs</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f17;
      --card-bg: #121824;
      --border: #222f3e;
      --text: #e2e8f0;
      --text-muted: #8395a7;
      --accent: #d4af37;
      --error: #ff5252;
      --warn: #ffb142;
      --info: #34ace0;
      --debug: #a55eea;
      --success: #33d9b2;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border);
      padding: 16px 24px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .badge {
      background: rgba(212, 175, 55, 0.15);
      color: var(--accent);
      border: 1px solid rgba(212, 175, 55, 0.3);
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    h1 { font-size: 18px; font-weight: 700; }
    .controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }
    input, select, button {
      background: #1a2233;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      outline: none;
      transition: all 0.2s;
    }
    input:focus, select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2);
    }
    button {
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    button.primary {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
    }
    button.primary:hover {
      filter: brightness(1.1);
    }
    button.danger {
      background: rgba(255, 82, 82, 0.15);
      color: var(--error);
      border-color: rgba(255, 82, 82, 0.3);
    }
    button.danger:hover {
      background: var(--error);
      color: #fff;
    }
    .stats-bar {
      background: rgba(18, 24, 36, 0.7);
      border-bottom: 1px solid var(--border);
      padding: 10px 24px;
      display: flex;
      gap: 20px;
      font-size: 12px;
      color: var(--text-muted);
      overflow-x: auto;
    }
    .stat-item {
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .stat-val {
      color: var(--text);
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
    }
    main {
      flex: 1;
      padding: 16px 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .log-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .log-list {
      padding: 12px;
      overflow-y: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12.5px;
      line-height: 1.6;
      max-height: calc(100vh - 200px);
    }
    .log-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 6px 10px;
      border-radius: 6px;
      margin-bottom: 2px;
      word-break: break-all;
    }
    .log-row:hover {
      background: rgba(255, 255, 255, 0.03);
    }
    .log-time {
      color: var(--text-muted);
      font-size: 11px;
      white-space: nowrap;
      min-width: 145px;
    }
    .log-level {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      min-width: 52px;
      text-align: center;
    }
    .level-error { background: rgba(255, 82, 82, 0.2); color: var(--error); }
    .level-warn { background: rgba(255, 177, 66, 0.2); color: var(--warn); }
    .level-info { background: rgba(52, 172, 224, 0.2); color: var(--info); }
    .level-debug { background: rgba(165, 94, 234, 0.2); color: var(--debug); }
    .log-source {
      color: #718096;
      font-size: 11px;
      min-width: 60px;
    }
    .log-msg {
      flex: 1;
      color: var(--text);
    }
    .log-context {
      margin-top: 4px;
      padding: 6px 10px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 4px;
      font-size: 11.5px;
      color: #94a3b8;
      overflow-x: auto;
    }
    .empty-state {
      padding: 60px 20px;
      text-align: center;
      color: var(--text-muted);
    }
    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
      display: inline-block;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { opacity: 0.4; }
      50% { opacity: 1; }
      100% { opacity: 0.4; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span class="live-dot"></span>
      <h1>Ajda Production Logs</h1>
      <span class="badge">Live Server Monitor</span>
    </div>

    <div class="controls">
      <input type="text" id="search" placeholder="Search logs (message, url, id)..." style="min-width: 240px;">
      <select id="levelFilter">
        <option value="all">All Levels</option>
        <option value="error">Error Only</option>
        <option value="warn">Warn Only</option>
        <option value="info">Info Only</option>
        <option value="debug">Debug Only</option>
      </select>
      <select id="limitFilter">
        <option value="100">100 lines</option>
        <option value="250">250 lines</option>
        <option value="500">500 lines</option>
        <option value="1000">1000 lines</option>
      </select>
      <select id="sourceFilter">
        <option value="buffer">Memory Buffer</option>
        <option value="file">Disk File (prod.log)</option>
      </select>
      <button class="primary" id="refreshBtn">↻ Refresh</button>
      <button id="autoBtn">⏸ Pause Auto-Refresh</button>
      <button class="danger" id="clearBtn">🗑 Clear</button>
      <a href="/api/logs/raw?key=${secretKey}" target="_blank" style="text-decoration:none;">
        <button type="button">📄 Raw Text</button>
      </a>
    </div>
  </header>

  <div class="stats-bar" id="statsBar">
    <div class="stat-item">Uptime: <span class="stat-val" id="statUptime">-</span></div>
    <div class="stat-item">Memory RSS: <span class="stat-val" id="statRss">-</span></div>
    <div class="stat-item">Heap Used: <span class="stat-val" id="statHeap">-</span></div>
    <div class="stat-item">Node: <span class="stat-val" id="statNode">-</span></div>
    <div class="stat-item">Platform: <span class="stat-val" id="statPlatform">-</span></div>
    <div class="stat-item">Total Logs: <span class="stat-val" id="statTotal">-</span></div>
    <div class="stat-item" style="color:var(--error)">Errors: <span class="stat-val" id="statErrors">-</span></div>
    <div class="stat-item" style="color:var(--warn)">Warnings: <span class="stat-val" id="statWarns">-</span></div>
  </div>

  <main>
    <div class="log-container">
      <div class="log-list" id="logList">
        <div class="empty-state">Loading server logs...</div>
      </div>
    </div>
  </main>

  <script>
    const SECRET_KEY = '${secretKey}';
    let autoRefresh = true;
    let autoTimer = null;

    const elList = document.getElementById('logList');
    const elSearch = document.getElementById('search');
    const elLevel = document.getElementById('levelFilter');
    const elLimit = document.getElementById('limitFilter');
    const elSource = document.getElementById('sourceFilter');
    const elRefresh = document.getElementById('refreshBtn');
    const elAuto = document.getElementById('autoBtn');
    const elClear = document.getElementById('clearBtn');

    async function fetchLogs() {
      try {
        const level = elLevel.value;
        const search = encodeURIComponent(elSearch.value.trim());
        const limit = elLimit.value;
        const source = elSource.value;

        const url = \`/api/logs?key=\${SECRET_KEY}&level=\${level}&search=\${search}&limit=\${limit}&source=\${source}\`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error('HTTP ' + res.status + ': ' + res.statusText);
        }
        const data = await res.json();
        render(data);
      } catch (err) {
        elList.innerHTML = \`<div class="empty-state" style="color:var(--error)">Failed to fetch logs: \${err.message}</div>\`;
      }
    }

    function render(data) {
      // Update stats
      if (data.stats) {
        document.getElementById('statUptime').textContent = data.stats.uptimeFormatted;
        document.getElementById('statRss').textContent = data.stats.memory.rssMb + ' MB';
        document.getElementById('statHeap').textContent = data.stats.memory.heapUsedMb + ' MB';
        document.getElementById('statNode').textContent = data.stats.nodeVersion;
        document.getElementById('statPlatform').textContent = data.stats.platform;
        document.getElementById('statTotal').textContent = data.stats.counts.total;
        document.getElementById('statErrors').textContent = data.stats.counts.error;
        document.getElementById('statWarns').textContent = data.stats.counts.warn;
      }

      if (!data.entries || data.entries.length === 0) {
        elList.innerHTML = '<div class="empty-state">No matching log entries found.</div>';
        return;
      }

      const rows = data.entries.map(e => {
        const time = new Date(e.timestamp).toLocaleString();
        const ctxHtml = e.context ? \`<pre class="log-context">\${escapeHtml(JSON.stringify(e.context, null, 2))}</pre>\` : '';
        return \`
          <div class="log-row">
            <span class="log-time">\${time}</span>
            <span class="log-level level-\${e.level}">\${e.level}</span>
            <span class="log-source">[\${escapeHtml(e.source || 'app')}]</span>
            <div class="log-msg">
              <div>\${escapeHtml(e.message)}</div>
              \${ctxHtml}
            </div>
          </div>
        \`;
      }).join('');

      elList.innerHTML = rows;
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    async function clearLogs() {
      if (!confirm('Are you sure you want to clear production logs? This cannot be undone.')) return;
      try {
        await fetch(\`/api/logs/clear?key=\${SECRET_KEY}\`, { method: 'POST' });
        await fetchLogs();
      } catch (err) {
        alert('Failed to clear logs: ' + err.message);
      }
    }

    elRefresh.addEventListener('click', fetchLogs);
    elClear.addEventListener('click', clearLogs);
    elLevel.addEventListener('change', fetchLogs);
    elLimit.addEventListener('change', fetchLogs);
    elSource.addEventListener('change', fetchLogs);
    let debounceTimer;
    elSearch.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchLogs, 300);
    });

    elAuto.addEventListener('click', () => {
      autoRefresh = !autoRefresh;
      if (autoRefresh) {
        elAuto.textContent = '⏸ Pause Auto-Refresh';
        startAuto();
      } else {
        elAuto.textContent = '▶ Resume Auto-Refresh';
        clearInterval(autoTimer);
      }
    });

    function startAuto() {
      clearInterval(autoTimer);
      autoTimer = setInterval(() => {
        if (autoRefresh) fetchLogs();
      }, 3000);
    }

    fetchLogs();
    startAuto();
  </script>
</body>
</html>`;

    reply.header('Content-Type', 'text/html; charset=utf-8');
    return html;
  });
};
