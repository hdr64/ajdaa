import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  source?: string;
  reqId?: string;
}

export interface LogStats {
  uptimeSeconds: number;
  uptimeFormatted: string;
  nodeVersion: string;
  platform: string;
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  counts: {
    total: number;
    error: number;
    warn: number;
    info: number;
    debug: number;
  };
}

class LoggerService {
  private buffer: LogEntry[] = [];
  private readonly maxBufferSize = 2000;
  private readonly logFilePath: string;
  private idCounter = 0;

  constructor() {
    this.logFilePath = config.logs.filePath;
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    try {
      const dir = path.dirname(this.logFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      console.error('[LoggerService] Failed to create log directory:', err);
    }
  }

  /**
   * Log an event into both the in-memory ring buffer and the persistent log file.
   */
  public log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    source = 'app',
    reqId?: string
  ): LogEntry {
    this.idCounter += 1;
    const entry: LogEntry = {
      id: `${Date.now()}-${this.idCounter}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      source,
      reqId,
    };

    // 1. Maintain in-memory ring buffer
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    // 2. Persist formatted line to disk asynchronously
    this.appendToFile(entry);

    return entry;
  }

  public error(message: string, context?: Record<string, unknown>, source = 'app') {
    return this.log('error', message, context, source);
  }

  public warn(message: string, context?: Record<string, unknown>, source = 'app') {
    return this.log('warn', message, context, source);
  }

  public info(message: string, context?: Record<string, unknown>, source = 'app') {
    return this.log('info', message, context, source);
  }

  public debug(message: string, context?: Record<string, unknown>, source = 'app') {
    return this.log('debug', message, context, source);
  }

  private appendToFile(entry: LogEntry) {
    try {
      const line = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}${
        entry.context ? ' ' + JSON.stringify(entry.context) : ''
      }\n`;
      fs.appendFile(this.logFilePath, line, (err) => {
        if (err && config.env !== 'test') {
          console.error('[LoggerService] Failed to write log to file:', err.message);
        }
      });
    } catch {
      // Swallowed to prevent logging failure from crashing worker
    }
  }

  /**
   * Get filtered logs from buffer or disk file.
   */
  public getLogs(options: {
    level?: string;
    search?: string;
    limit?: number;
    source?: 'buffer' | 'file';
  }) {
    const limit = Math.min(Math.max(options.limit || 100, 1), 1000);
    const filterLevel = options.level?.toLowerCase();
    const search = options.search?.toLowerCase().trim();

    let entries: LogEntry[] = [];

    if (options.source === 'file') {
      entries = this.readLogsFromFile();
    } else {
      // Default: copy from in-memory ring buffer
      entries = [...this.buffer];
    }

    // Apply filters
    if (filterLevel && filterLevel !== 'all') {
      entries = entries.filter((e) => e.level.toLowerCase() === filterLevel);
    }

    if (search) {
      entries = entries.filter((e) => {
        const msgMatch = e.message.toLowerCase().includes(search);
        const sourceMatch = e.source?.toLowerCase().includes(search);
        const contextMatch = e.context ? JSON.stringify(e.context).toLowerCase().includes(search) : false;
        return msgMatch || sourceMatch || contextMatch;
      });
    }

    // Newest first
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const paginated = entries.slice(0, limit);

    return {
      entries: paginated,
      returnedCount: paginated.length,
      totalMatched: entries.length,
      stats: this.getStats(),
    };
  }

  /**
   * Read and parse lines from physical log file if available.
   */
  private readLogsFromFile(): LogEntry[] {
    try {
      if (!fs.existsSync(this.logFilePath)) {
        return [...this.buffer];
      }
      const raw = fs.readFileSync(this.logFilePath, 'utf-8');
      const lines = raw.split('\n').filter((l) => l.trim().length > 0);
      const parsed: LogEntry[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Expected format: [2026-10-01T00:00:00.000Z] [LEVEL] [SOURCE] message {json}
        const match = line.match(/^\[(.*?)\]\s+\[(.*?)\]\s+\[(.*?)\]\s+(.*)$/);
        if (match) {
          const [, timestamp, levelStr, source, rest] = match;
          const level = levelStr.toLowerCase() as LogLevel;
          let message = rest;
          let context: Record<string, unknown> | undefined;

          const jsonIndex = rest.indexOf(' {');
          if (jsonIndex !== -1) {
            message = rest.substring(0, jsonIndex);
            try {
              context = JSON.parse(rest.substring(jsonIndex + 1));
            } catch {
              message = rest;
            }
          }

          parsed.push({
            id: `file-${i}`,
            timestamp,
            level: ['error', 'warn', 'info', 'debug'].includes(level) ? level : 'info',
            message,
            source,
            context,
          });
        } else {
          parsed.push({
            id: `raw-${i}`,
            timestamp: new Date().toISOString(),
            level: 'info',
            message: line,
            source: 'file',
          });
        }
      }
      return parsed;
    } catch (err) {
      this.error('Error reading log file from disk', { err: String(err) });
      return [...this.buffer];
    }
  }

  /**
   * Get raw log file content as plain text.
   */
  public getRawFileContent(tailLines = 500): string {
    try {
      if (fs.existsSync(this.logFilePath)) {
        const content = fs.readFileSync(this.logFilePath, 'utf-8');
        const lines = content.split('\n');
        return lines.slice(-tailLines).join('\n');
      }
    } catch {
      // Fallback to buffer
    }

    return this.buffer
      .map(
        (e) =>
          `[${e.timestamp}] [${e.level.toUpperCase()}] [${e.source || 'app'}] ${e.message}${
            e.context ? ' ' + JSON.stringify(e.context) : ''
          }`
      )
      .join('\n');
  }

  /**
   * Clear in-memory logs and truncate log file.
   */
  public clearLogs(): { cleared: boolean; memoryEntries: number } {
    const count = this.buffer.length;
    this.buffer = [];

    try {
      if (fs.existsSync(this.logFilePath)) {
        fs.writeFileSync(this.logFilePath, '');
      }
    } catch (err) {
      console.error('[LoggerService] Failed to truncate log file:', err);
    }

    this.info('Production logs cleared by administrator', {}, 'system');

    return { cleared: true, memoryEntries: count };
  }

  public getStats(): LogStats {
    const uptime = process.uptime();
    const mem = process.memoryUsage();

    let error = 0;
    let warn = 0;
    let info = 0;
    let debug = 0;

    for (const e of this.buffer) {
      if (e.level === 'error') error++;
      else if (e.level === 'warn') warn++;
      else if (e.level === 'info') info++;
      else if (e.level === 'debug') debug++;
    }

    return {
      uptimeSeconds: Math.floor(uptime),
      uptimeFormatted: this.formatUptime(uptime),
      nodeVersion: process.version,
      platform: `${process.platform} (${process.arch})`,
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      },
      counts: {
        total: this.buffer.length,
        error,
        warn,
        info,
        debug,
      },
    };
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    parts.push(`${secs}s`);
    return parts.join(' ');
  }
}

export const loggerService = new LoggerService();
