import { defineConfig } from 'vitest/config';
import { applyTestEnvironment, createTestEnvironment } from './test/env.js';

// Created here, in the main process, so the values are known before any worker
// starts. `test.env` is what actually injects them into each worker, which is
// why propagation is explicit rather than inherited.
const testEnvironment = createTestEnvironment();
applyTestEnvironment(testEnvironment);

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env: { ...testEnvironment },
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-env.ts'],
    // One shared SQLite file: test files must not run concurrently or they race
    // each other's writes (and the SQLite write lock).
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
