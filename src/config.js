import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// PORT, HOST, ALLOWED_HOSTS and KEY_SOURCE come from the real environment first, then
// from the .env file, then from the defaults. On your own PC, API keys are entered on the
// Settings page. On a server (KEY_SOURCE=server) they come only from the real environment,
// which systemd fills from a protected file (see docs/deploy-security.md).

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

  // Extra host names the app answers to, e.g. the public name behind Caddy. Empty on a PC.
  const allowedHosts = String(env.ALLOWED_HOSTS || fileValues.ALLOWED_HOSTS || '')
    .split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
  for (const name of allowedHosts) {
    if (!/^[a-z0-9.-]+$/.test(name)) {
      throw new ConfigError(`ALLOWED_HOSTS must be host names separated by commas, but it has "${name}".`);
    }
  }

  const keySource = (env.KEY_SOURCE || fileValues.KEY_SOURCE || 'app').trim();
  if (!['app', 'server'].includes(keySource)) {
    throw new ConfigError(`KEY_SOURCE must be "app" or "server", but it is "${keySource}".`);
  }
  // Keys are read from the real environment only, never from .env, so they never sit in the project folder.
  const serverKeys = keySource === 'server'
    ? {
      anthropic_api_key: (env.CHEF_BUDDY_ANTHROPIC_KEY || '').trim() || null,
      openai_api_key: (env.CHEF_BUDDY_OPENAI_KEY || '').trim() || null,
    }
    : null;
  return { port, host, allowedHosts, serverKeys };
}

export function loadConfig(envFile) {
  return resolveConfig(readEnvFile(envFile));
}
