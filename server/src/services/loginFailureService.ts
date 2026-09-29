import { config } from '../config/env.js';

interface FailureRecord {
  count: number;
  expiresAt: number;
}

export class LoginFailureTracker {
  private failures = new Map<string, FailureRecord>();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number = config.loginFailMax, windowMs: number = config.loginFailWindowMs) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  private normalizeKey(email: string): string {
    return email.trim().toLowerCase();
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.failures.entries()) {
      if (now >= record.expiresAt) {
        this.failures.delete(key);
      }
    }
  }

  isLocked(email: string): { locked: boolean; retryAfter: number } {
    this.cleanExpired();
    const key = this.normalizeKey(email);
    const record = this.failures.get(key);
    if (!record) return { locked: false, retryAfter: 0 };

    const now = Date.now();
    if (now >= record.expiresAt) {
      this.failures.delete(key);
      return { locked: false, retryAfter: 0 };
    }

    if (record.count >= this.maxAttempts) {
      const retryAfter = Math.max(1, Math.ceil((record.expiresAt - now) / 1000));
      return { locked: true, retryAfter };
    }

    return { locked: false, retryAfter: 0 };
  }

  recordFailure(email: string): { locked: boolean; retryAfter: number } {
    this.cleanExpired();
    const key = this.normalizeKey(email);
    const now = Date.now();
    const record = this.failures.get(key);

    if (!record || now >= record.expiresAt) {
      this.failures.set(key, { count: 1, expiresAt: now + this.windowMs });
      return { locked: false, retryAfter: 0 };
    }

    record.count += 1;
    if (record.count >= this.maxAttempts) {
      const retryAfter = Math.max(1, Math.ceil((record.expiresAt - now) / 1000));
      return { locked: true, retryAfter };
    }

    return { locked: false, retryAfter: 0 };
  }

  recordSuccess(email: string): void {
    const key = this.normalizeKey(email);
    this.failures.delete(key);
  }

  reset(): void {
    this.failures.clear();
  }
}

export const loginFailureTracker = new LoginFailureTracker();
