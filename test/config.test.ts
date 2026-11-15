import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { baseUrl, parseEnv, resolveToken } from '../src/config.js';

function config(local?: string, global?: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'liandi-local-'));
  const home = mkdtempSync(join(tmpdir(), 'liandi-home-'));
  if (local !== undefined) writeFileSync(join(cwd, '.env'), local);
  if (global !== undefined) {
    mkdirSync(join(home, 'liandi'), { recursive: true });
    writeFileSync(join(home, 'liandi', '.env'), global);
  }
  return { cwd, home };
}

describe('token resolution', () => {
  it('uses the exact priority and supports .env syntax', () => {
    const { cwd, home } = config('LIANDI_TOKEN=local', 'export LIANDI_TOKEN="global"');
    expect(resolveToken('flag', { LIANDI_TOKEN: 'env' }, cwd, home)).toEqual({ token: 'flag', source: 'flag' });
    expect(resolveToken(undefined, { LIANDI_TOKEN: 'env' }, cwd, home)).toEqual({ token: 'env', source: 'environment' });
    expect(resolveToken(undefined, {}, cwd, home)).toEqual({ token: 'local', source: 'local' });
    expect(resolveToken(undefined, {}, mkdtempSync(join(tmpdir(), 'liandi-empty-')), home)).toEqual({ token: 'global', source: 'global' });
  });
  it('ignores blank values, comments and unrelated variables', () => {
    const { cwd, home } = config('# comment\nLIANDI_TOKEN = local # note\nOTHER=value', 'LIANDI_TOKEN=global');
    expect(resolveToken(undefined, { LIANDI_TOKEN: ' ' }, cwd, home)).toEqual({ token: 'local', source: 'local' });
    expect(parseEnv("A='x#y'\nB=\"z\\n\"\nC=value").A).toBe('x#y');
  });
  it('does not fall back when files are absent', () => {
    const { cwd, home } = config();
    expect(resolveToken(undefined, {}, cwd, home)).toEqual({});
  });
});

describe('base URL', () => {
  it('defaults to the official HTTPS endpoint', () => expect(baseUrl({})).toBe('https://ld246.com'));
  it('supports test/private servers and validates input', () => {
    expect(baseUrl({}, 'http://127.0.0.1:1234/')).toBe('http://127.0.0.1:1234');
    expect(() => baseUrl({}, 'file:///tmp/x')).toThrow('HTTP or HTTPS');
    expect(() => baseUrl({}, 'bad')).toThrow('absolute');
  });
});
