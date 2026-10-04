import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// PORT and HOST come from the real environment first, then from the .env file,
// then from the defaults. API keys are NOT configured here: they are entered on
// the Settings page.

export class ConfigError extends Error {}

// Returns the values in a .env file, or {} if there is no such file.
export function readEnvFile(file) {
  if (!existsSync(file)) return {};
  // Windows Notepad can save a file with an invisible byte-order mark (BOM) at the
  // start. Left in, it becomes part of the first key name, so PORT would be ignored.
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
  return parseEnv(text);
}

export function resolveConfig(fileValues = {}, env = process.env) {
  const rawPort = env.PORT || fileValues.PORT || '3000';
  const port = Number(rawPort);
  if (!/^\d+$/.test(String(rawPort).trim()) || port < 1 || port > 65535) {
    throw new ConfigError(
      `PORT must be a whole number from 1 to 65535, but it is "${rawPort}". ` +
      'Fix it in your .env file (or remove the line to use 3000).'
    );
  }
  // 127.0.0.1 means only this computer can open the app. Anything else is an explicit choice.
  const host = (env.HOST || fileValues.HOST || '127.0.0.1').trim();
  return { port, host };
}

export function loadConfig(envFile) {
  return resolveConfig(readEnvFile(envFile));
}
