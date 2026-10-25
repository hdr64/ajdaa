import { requireTestEnvironment } from './env.js';

/**
 * Runs before every test file. Setup files are imported before the test file, so
 * this also throws before `src/config/env.ts` gets a chance to read a `.env`
 * pointing at a real database.
 */
requireTestEnvironment();
