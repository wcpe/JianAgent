import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidation');

/**
 * Validates critical environment variables at startup.
 * Throws an error for any value that is set but invalid.
 * Logs a warning for recommended variables that are not set.
 */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
  validatePort(env['PORT']);
  validateDbPath(env['DB_PATH']);
  validateJwtSecret(env['JWT_SECRET']);
  warnIfMissing(env);
}

function validatePort(raw: string | undefined): void {
  if (raw === undefined || raw.trim() === '') {
    return;
  }
  const value = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(
      `Invalid PORT value "${raw}". Must be an integer between 1 and 65535.`,
    );
  }
}

function validateDbPath(raw: string | undefined): void {
  if (raw === undefined || raw.trim() === '') {
    return;
  }
  const dirPath = path.resolve(raw.trim());
  if (!fs.existsSync(dirPath)) {
    throw new Error(
      `DB_PATH directory does not exist: "${dirPath}".`,
    );
  }
  const stat = fs.statSync(dirPath);
  if (!stat.isDirectory()) {
    throw new Error(
      `DB_PATH is not a directory: "${dirPath}".`,
    );
  }
  try {
    fs.accessSync(dirPath, fs.constants.W_OK);
  } catch (_err) {
    throw new Error(
      `DB_PATH directory is not writable: "${dirPath}".`,
    );
  }
}

function validateJwtSecret(raw: string | undefined): void {
  if (raw === undefined || raw.trim() === '') {
    return;
  }
  if (raw.trim().length < 32) {
    throw new Error(
      `JWT_SECRET is too short (${raw.trim().length} chars). Must be at least 32 characters.`,
    );
  }
}

function warnIfMissing(env: NodeJS.ProcessEnv): void {
  const recommended: Array<{ key: string; reason: string }> = [
    {
      key: 'JWT_SECRET',
      reason:
        'used to sign authentication tokens; a random secret should be set in production',
    },
    {
      key: 'DB_PATH',
      reason: 'path to the database directory; defaults to ./data if unset',
    },
    {
      key: 'NODE_ENV',
      reason: 'should be set to "production" in production deployments',
    },
  ];

  for (const { key, reason } of recommended) {
    if (!env[key]) {
      logger.warn(`Recommended env var ${key} is not set — ${reason}`);
    }
  }
}
