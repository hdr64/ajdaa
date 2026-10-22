import { config } from '../../src/config/env.js';

/**
 * Prints the parsed configuration as JSON.
 *
 * `src/config/env.ts` validates the environment when it is imported and exits
 * the process when the configuration is not acceptable, so the only honest way
 * to test it is to run it in its own process.
 */

process.stdout.write(
  JSON.stringify({
    host: config.host,
    trustProxy: config.trustProxy,
    logsSecretKey: config.logs.secretKey,
    developerSecretKey: config.developer.secretKey,
    developerEmails: config.developer.emails,
    jwtSecret: config.jwtSecret,
  })
);
