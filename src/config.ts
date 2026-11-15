import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { LiandiError } from './errors.js';

export interface Environment {
  [key: string]: string | undefined;
}

export type TokenSource = 'flag' | 'environment' | 'local' | 'global';

export interface TokenResolution {
  token?: string;
  source?: TokenSource;
}

/** Deliberately small .env parser: token configuration does not need shell evaluation. */
export function parseEnv(text: string): Environment {
  const result: Environment = {};
  // Strip a UTF-8 BOM: Windows editors commonly add one.
  for (const line of text.replace(/^\uFEFF/u, '').split(/\r?\n/u)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/u);
    if (!match || !match[1]) continue;
    let value = match[2] ?? '';
    if (value.startsWith("'")) {
      const end = value.indexOf("'", 1);
      if (end < 0) throw new LiandiError('Invalid .env: unterminated single quote', 'CONFIG_ERROR', 2);
      value = value.slice(1, end);
    } else if (value.startsWith('"')) {
      const end = value.indexOf('"', 1);
      if (end < 0) throw new LiandiError('Invalid .env: unterminated double quote', 'CONFIG_ERROR', 2);
      value = value.slice(1, end).replace(/\\n/gu, '\n').replace(/\\r/gu, '\r').replace(/\\t/gu, '\t').replace(/\\(["\\])/gu, '$1');
    } else {
      value = value.replace(/\s+#.*$/u, '').trimEnd();
    }
    result[match[1]] = value;
  }
  return result;
}

function readEnv(path: string, label: string): Environment {
  try {
    return parseEnv(readFileSync(path, 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    if (error instanceof LiandiError) throw error;
    throw new LiandiError(`Cannot read ${label} configuration`, 'CONFIG_ERROR', 2);
  }
}

/** Per-user config directory: %APPDATA% on Windows, XDG elsewhere. */
export function configHome(env: Environment, platform = process.platform, home = homedir()): string {
  if (platform === 'win32' && env.APPDATA) return env.APPDATA;
  return env.XDG_CONFIG_HOME || join(home, '.config');
}

export function resolveToken(
  flag: string | undefined,
  env: Environment,
  cwd = process.cwd(),
  home = configHome(env),
): TokenResolution {
  if (flag?.trim()) return { token: flag.trim(), source: 'flag' };
  if (env.LIANDI_TOKEN?.trim()) return { token: env.LIANDI_TOKEN.trim(), source: 'environment' };
  const local = readEnv(join(cwd, '.env'), 'local').LIANDI_TOKEN?.trim();
  if (local) return { token: local, source: 'local' };
  const global = readEnv(join(home, 'liandi', '.env'), 'global').LIANDI_TOKEN?.trim();
  if (global) return { token: global, source: 'global' };
  return {};
}

export function baseUrl(env: Environment, flag?: string): string {
  const value = flag || env.LIANDI_BASE_URL || 'https://ld246.com';
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new LiandiError('Base URL must be an absolute HTTP(S) URL', 'CONFIG_ERROR', 2);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new LiandiError('Base URL must use HTTP or HTTPS', 'CONFIG_ERROR', 2);
  }
  return url.href.replace(/\/$/u, '');
}
