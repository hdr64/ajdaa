import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { config, secretMatches } from '../config/env.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import { loggerService } from '../services/loggerService.js';

const querySchema = z.object({
  level: z.enum(['all', 'error', 'warn', 'info', 'debug']).optional().default('all'),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
  source: z.enum(['buffer', 'file']).optional().default('buffer'),
});

const linesQuerySchema = z.object({
  lines: z.coerce.number().int().min(1).max(5000).optional().default(500),
});

/** The prefix this plugin is registered under (see `app.ts`). */
const LOGS_PREFIX = '/api/logs';

/**
 * Endpoints that stay reachable without the super-admin + key pair:
 *
 * - `/client-error` is the browser's error beacon: it must work for a visitor
 *   who is not signed in.
 * - `/view` only renders the viewer shell. Every byte of log data it shows is
 *   fetched separately through the guarded endpoints below.
 */
const PUBLIC_LOG_PATHS = new Set([`${LOGS_PREFIX}/client-error`, `${LOGS_PREFIX}/view`]);

function isPublicLogPath(request: FastifyRequest): boolean {
  return PUBLIC_LOG_PATHS.has(request.url.split('?')[0]);
}

/**
 * The shared key is the second factor, and it is only accepted in a header.
 * A query parameter would end up in access logs, proxy logs and browser
 * history, so `?key=` is no longer honoured.
 */
function hasValidLogsKey(request: FastifyRequest): boolean {
  const header = request.headers['x-logs-key'];
  const provided = typeof header === 'string' ? header : undefined;
  return secretMatches(provided, config.logs.secretKey);
}

/**
 * The viewer page.
 *
 * It carries no secret: the key is typed into the form by the operator and
 * sent as the `x-logs-key` header, and the admin session token is read from
 * the browser's storage by the SPA. Nothing is interpolated into this
 * document, so there is no value that could leak a secret or inject markup.
 */
const LOG_VIEW_HTML = `<!DOCTYPE html>
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
    .access-bar {
      background: rgba(212, 175, 55, 0.07);
      border-bottom: 1px solid var(--border);
      padding: 12px 24px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .access-bar input { min-width: 260px; font-family: 'JetBrains Mono', monospace; }
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
      max-height: calc(100vh - 260px);
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
      <button id="rawBtn">📄 Raw Text</button>
      <button class="danger" id="clearBtn">🗑 Clear</button>
    </div>
  </header>

  <div class="access-bar">
    <label for="logsKey">Log key</label>
    <input type="password" id="logsKey" placeholder="Paste LOGS_SECRET_KEY" autocomplete="off">
    <button id="applyKeyBtn">Apply key</button>
    <span>Requires an active super admin session in this browser plus the log key.</span>
  </div>

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
    // Same key the admin SPA stores its session token under.
    var TOKEN_STORAGE_KEY = 'ajdaa_admin_token';
    var autoRefresh = true;
    var autoTimer = null;

    var elList = document.getElementById('logList');
    var elSearch = document.getElementById('search');
    var elLevel = document.getElementById('levelFilter');
    var elLimit = document.getElementById('limitFilter');
    var elSource = document.getElementById('sourceFilter');
    var elRefresh = document.getElementById('refreshBtn');
    var elAuto = document.getElementById('autoBtn');
    var elClear = document.getElementById('clearBtn');
    var elRaw = document.getElementById('rawBtn');
    var elKey = document.getElementById('logsKey');
    var elApplyKey = document.getElementById('applyKeyBtn');

    function readToken() {
      try {
        return window.localStorage.getItem(TOKEN_STORAGE_KEY) || '';
      } catch (err) {
        return '';
      }
    }

    // The session token and the log key travel as headers only: neither ever
    // appears in a URL, a query string or the server's request log.
    function authHeaders() {
      var headers = { 'Accept': 'application/json' };
      var token = readToken();
      if (token) headers['Authorization'] = 'Bearer ' + token;
      var key = elKey ? elKey.value.trim() : '';
      if (key) headers['x-logs-key'] = key;
      return headers;
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    async function fetchLogs() {
      try {
        var params = new URLSearchParams();
        params.set('level', elLevel.value);
        params.set('search', elSearch.value.trim());
        params.set('limit', elLimit.value);
        params.set('source', elSource.value);

        var res = await fetch('/api/logs?' + params.toString(), { headers: authHeaders() });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            throw new Error('Not authorised: sign in as a super admin in this browser, then apply the log key.');
          }
          throw new Error('HTTP ' + res.status + ': ' + res.statusText);
        }
        var data = await res.json();
        render(data);
      } catch (err) {
        elList.innerHTML = '<div class="empty-state" style="color:var(--error)">' + escapeHtml(err.message) + '</div>';
      }
    }

    function render(data) {
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

      var rows = data.entries.map(function (entry) {
        var time = new Date(entry.timestamp).toLocaleString();
        var ctxHtml = entry.context
          ? '<pre class="log-context">' + escapeHtml(JSON.stringify(entry.context, null, 2)) + '</pre>'
          : '';
        return '<div class="log-row">' +
          '<span class="log-time">' + escapeHtml(time) + '</span>' +
          '<span class="log-level level-' + escapeHtml(entry.level) + '">' + escapeHtml(entry.level) + '</span>' +
          '<span class="log-source">[' + escapeHtml(entry.source || 'app') + ']</span>' +
          '<div class="log-msg"><div>' + escapeHtml(entry.message) + '</div>' + ctxHtml + '</div>' +
          '</div>';
      }).join('');

      elList.innerHTML = rows;
    }

    async function clearLogs() {
      if (!confirm('Are you sure you want to clear production logs? This cannot be undone.')) return;
      try {
        var res = await fetch('/api/logs/clear', { method: 'POST', headers: authHeaders() });
        if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + res.statusText);
        await fetchLogs();
      } catch (err) {
        alert('Failed to clear logs: ' + err.message);
      }
    }

    async function openRawLogs() {
      try {
        var res = await fetch('/api/logs/raw', { headers: authHeaders() });
        if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + res.statusText);
        var text = await res.text();
        var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      } catch (err) {
        alert('Failed to load the raw log: ' + err.message);
      }
    }

    elRefresh.addEventListener('click', fetchLogs);
    elClear.addEventListener('click', clearLogs);
    elRaw.addEventListener('click', openRawLogs);
    elApplyKey.addEventListener('click', fetchLogs);
    elLevel.addEventListener('change', fetchLogs);
    elLimit.addEventListener('change', fetchLogs);
    elSource.addEventListener('change', fetchLogs);

    var debounceTimer;
    elSearch.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchLogs, 300);
    });

    elAuto.addEventListener('click', function () {
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
      autoTimer = setInterval(function () {
        if (autoRefresh) fetchLogs();
      }, 3000);
    }

    fetchLogs();
    startAuto();
  </script>
</body>
</html>`;

export const logsRoutes: FastifyPluginAsync = async (fastify) => {
  // Guard middleware: an active super admin (re-read from the database on
  // every request) plus the shared log key, which is only accepted in a
  // header.
  fastify.addHook('preHandler', async (request, reply) => {
    if (isPublicLogPath(request)) return;

    // `LOGS_PUBLIC` is an explicit, documented opt-out for a deployment that
    // really wants an open log stream. It is off by default.
    if (config.logs.isPublic) return;

    // `authenticate` and `requireSuperAdmin` answer the request themselves;
    // `reply.sent` is what tells the hook the chain must stop here.
    await authenticate(request, reply);
    if (reply.sent) return reply;

    await requireSuperAdmin(request, reply);
    if (reply.sent) return reply;

    if (!hasValidLogsKey(request)) {
      return reply.status(401).send({
        error: 'Unauthorized access to production logs',
        message:
          'Provide the log key in the `x-logs-key` header together with an active super admin session.',
      });
    }
  });

  // 1. GET /api/logs - JSON API with filtering, pagination, and system telemetry
  fastify.get('/', async (request: FastifyRequest<{ Querystring: z.infer<typeof querySchema> }>) => {
    const query = querySchema.parse(request.query);
    const result = await loggerService.getLogs({
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
    const parsed = linesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid lines value' });
    }
    const text = await loggerService.getRawFileContent(parsed.data.lines);

    reply.header('Content-Type', 'text/plain; charset=utf-8');
    return text;
  });

  // 3. GET /api/logs/errors - Plain text raw errors.log stream
  fastify.get('/errors', async (request, reply) => {
    const parsed = linesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid lines value' });
    }
    const text = await loggerService.getRawErrorsFileContent(parsed.data.lines);

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
      // Strip CR/LF so a single report cannot forge extra log lines.
      const safeMessage = message.replace(/[\r\n]+/g, ' ');
      const safeStack = stack ? stack.replace(/[\r\n]+/g, ' ') : undefined;
      // Restrict source to a safe token set and cap its length.
      const safeSource = (source || 'frontend')
        .replace(/[^A-Za-z0-9_-]/g, '')
        .slice(0, 64) || 'frontend';
      // The reported URL and the referer are page URLs: only their paths are
      // kept, so a query string that a page happened to carry cannot end up
      // in the log.
      const referer = request.headers.referer;
      const refererPath = referer ? referer.split('?')[0] : undefined;
      const reportedPath = url ? url.split('?')[0] : undefined;

      loggerService.error(
        `Client error reported: ${safeMessage}`,
        {
          // context is spread first so it cannot override trusted fields.
          ...context,
          url: reportedPath || refererPath,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          stack: safeStack,
        },
        safeSource
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

  // 8. GET /api/logs/view - Rich HTML interactive live log viewer.
  // The page itself is public: it only renders the shell. Every log it shows
  // is fetched through the guarded endpoints above.
  fastify.get('/view', async (_request, reply: FastifyReply) => {
    reply.header('Content-Type', 'text/html; charset=utf-8');
    return LOG_VIEW_HTML;
  });
};
