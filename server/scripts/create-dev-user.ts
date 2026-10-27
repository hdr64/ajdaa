import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';
import { config as dotenvConfig } from 'dotenv';
import crypto from 'node:crypto';
import { createInterface } from 'node:readline';

import {
  buildDevUserData,
  generatePassword,
  isLocalDatabase,
  normalizeEmail,
  parseCliArgs,
  parseDbName,
  type CliArgs,
  validateName,
} from './lib/devUser.js';
import { meetsPasswordPolicy } from '../src/services/passwordPolicy.js';

dotenvConfig();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');
const isPostgres = connectionString.startsWith('postgres://') || connectionString.startsWith('postgresql://');
const adapter = isPostgres
  ? new PrismaPg({ connectionString })
  : new PrismaBetterSqlite3({ url: connectionString as ':memory:' | (string & {}) });
const prisma = new PrismaClient({ adapter });

/** Reads one line of visible input from the TTY. */
function readLine(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Reads a password from the TTY with hidden input (no echo). Implemented with
 * `process.stdin.setRawMode` so no new dependency is needed.
 */
function readPassword(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdout.write(prompt);
    let input = '';
    const onData = (chunk: Buffer) => {
      const char = chunk.toString();
      if (char === '\r' || char === '\n') {
        process.stdout.write('\n');
        finish(input);
      } else if (char === '\u0003') {
        // Ctrl+C
        process.stdout.write('^C\n');
        finish(null);
        process.exit(130);
      } else if (char === '\u007f' || char === '\b') {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        input += char;
      }
    };
    function finish(value: string | null): void {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      if (value === null) {
        reject(new Error('Interrupted'));
      } else {
        resolve(value);
      }
    }
    process.stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  let args: CliArgs;
  try {
    args = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  if (!args.email || (!args.name && !args.resetPassword)) {
    console.error('--email and --name are required (--name is optional with --reset-password).');
    process.exit(1);
  }

  let email: string;
  let name: string;
  try {
    email = normalizeEmail(args.email);
    name = args.resetPassword && !args.name ? '' : validateName(args.name);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      'DATABASE_URL is not set. Run from `server/` so Prisma loads `server/.env`.'
    );
    process.exit(1);
  }

  const dbName = parseDbName(databaseUrl);
  const isTestDb = dbName.endsWith('_test');
  const isLocalDb = isLocalDatabase(databaseUrl);

  // `--yes` skips confirmation but is never allowed on a production database.
  if (args.yes && !isTestDb && !isLocalDb) {
    console.error(
      '--yes is not allowed on a production database. Type the database name to confirm.'
    );
    process.exit(1);
  }

  // Ensure the super_admin role exists before doing anything else.
  const role = await prisma.role.findUnique({ where: { id: 'role_super_admin' } });
  if (!role) {
    console.error(
      "The 'role_super_admin' role does not exist. Run the migrations and seed first, then re-run this script."
    );
    process.exit(1);
  }

  // Check whether the email already exists.
  const existing = await prisma.adminUser.findUnique({ where: { email } });

  if (args.resetPassword) {
    if (!existing) {
      console.error(`No user found with email ${email}.`);
      process.exit(1);
    }
  } else if (existing) {
    console.error('user already exists');
    process.exit(1);
  }

  // Safety: print the database name (only), email, name and role before any write.
  console.log(`Database: ${dbName}`);
  console.log(`Email: ${email}`);
  console.log(`Name: ${name || existing?.name}`);
  console.log(`Role: super_admin`);

  // Ask for confirmation by typing the database name (typing `yes` is not enough).
  // Skipped with `--yes`, which is only allowed for test or local databases.
  if (!args.yes) {
    const typed = await readLine(`Type the database name ("${dbName}") to confirm: `);
    if (typed !== dbName) {
      console.error(
        'Confirmation aborted: typed name did not match the database name.'
      );
      process.exit(1);
    }
  }

  // Password: never accepted as a command-line argument or environment variable.
  let password: string;
  if (args.generate) {
    password = generatePassword();
  } else {
    password = await readPassword('Enter password: ');
    const confirm = await readPassword('Repeat password: ');
    if (password !== confirm) {
      console.error('Passwords do not match.');
      process.exit(1);
    }
  }

  if (!meetsPasswordPolicy(password)) {
    console.error(
      'Password does not meet requirements: at least 10 characters, at least one letter and one digit.'
    );
    process.exit(1);
  }

  // Mirror the seeded super admin entry: department text and departmentId
  // (computed the same way seed.ts computes it, `dept_` + md5(nameAr)).
  const departmentId = `dept_${crypto.createHash('md5').update('الإدارة التنفيذية').digest('hex')}`;
  const passwordHash = await bcrypt.hash(password, 10);
  const data = buildDevUserData(email, name, args.phone, passwordHash, departmentId);

  if (args.resetPassword && existing) {
    await prisma.adminUser.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
      },
    });
  } else {
    await prisma.adminUser.create({ data });
  }

  const user = await prisma.adminUser.findUnique({ where: { email } });

  console.log('Sign in at /admin/login');
  console.log(`Email-code login: ${user?.loginOtpEnabled ? 'enabled' : 'disabled'}`);
  console.log(
    'Remember to enable your authenticator / second factor when that feature exists.'
  );

  if (args.generate) {
    console.log(`Generated password: ${password}`);
    console.log('Change it at first login.');
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : 'An unexpected error occurred.');
  process.exit(1);
});
