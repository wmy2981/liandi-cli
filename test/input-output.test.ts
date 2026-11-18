import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { boolean, content, contentType, encodeSegment, integer, positiveInteger, size } from '../src/input.js';
import { formatOutput, redact, resolveColor } from '../src/output.js';

describe('input', () => {
  it('loads UTF-8 content from a file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'liandi-content-'));
    const file = join(dir, 'post.md');
    writeFileSync(file, '# 链滴\n中文内容');
    await expect(content(undefined, file)).resolves.toBe('# 链滴\n中文内容');
  });
  it('does not allow ambiguous or missing content', async () => {
    await expect(content('inline', 'file.md')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(content()).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(content(undefined, '/does/not/exist')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
  it('validates numbers, types and visibility', () => {
    expect(positiveInteger('2')).toBe(2);
    expect(() => positiveInteger('0')).toThrow();
    expect(size('64')).toBe(64);
    expect(() => size('65')).toThrow();
    expect(contentType('markdown')).toBe('markdown');
    expect(() => contentType('Markdown')).toThrow();
    expect(boolean('false')).toBe(false);
    expect(() => boolean('0')).toThrow();
  });
  it('rejects numbers that lose precision and path segments that change the endpoint', () => {
    expect(integer('-3')).toBe(-3);
    expect(() => integer('1000000000000000000000')).toThrow('out of range');
    expect(encodeSegment('C++', 'Tag')).toBe('C%2B%2B');
    expect(() => encodeSegment('..', 'Article ID')).toThrow();
    expect(() => encodeSegment('', 'Article ID')).toThrow();
  });
});

describe('output', () => {
  it('uses one JSON envelope and redacts credentials', () => {
    const result = JSON.parse(formatOutput({ ok: true, status: 'success', command: 'test', data: { code: 0 } }, true));
    expect(result).toEqual({ ok: true, status: 'success', command: 'test', data: { code: 0 } });
    expect(redact({ token: 'session', userPassword: 'y', nested: { twofactorAuthCode: '123456' }, title: 'ok' }))
      .toEqual({ token: 'session', userPassword: '[REDACTED]', nested: { twofactorAuthCode: '[REDACTED]' }, title: 'ok' });
  });
  it('makes dry-run and cancellation explicit in human output', () => {
    expect(formatOutput({ ok: true, status: 'dry-run', data: { method: 'POST' } }, false)).toContain('no request was sent');
    expect(formatOutput({ ok: true, status: 'cancelled' }, false)).toContain('Cancelled');
    expect(formatOutput({ ok: false, status: 'error', error: { code: 'X', message: 'bad' } }, false)).toBe('Error [X]: bad');
  });
  it('colors status lines and hints but never the data', () => {
    const error = formatOutput({ ok: false, status: 'error', error: { code: 'X', message: 'bad' } }, false, true);
    expect(error).toBe('\u001B[31mError [X]: bad\u001B[39m');
    const dryRun = formatOutput({ ok: true, status: 'dry-run', data: { method: 'POST' } }, false, true);
    expect(dryRun).toContain('\u001B[33mDry run: no request was sent.\u001B[39m');
    expect(dryRun.split('\n').slice(1).join('\n')).not.toContain('\u001B');
    const hinted = formatOutput({ ok: true, status: 'success', data: { code: 0 }, hint: 'run auth 2fa' }, false, true);
    expect(hinted).toContain('\u001B[36mrun auth 2fa\u001B[39m');
    expect(hinted.split('\n').slice(0, -1).join('\n')).not.toContain('\u001B');
  });
  it('never emits ANSI escapes in JSON mode', () => {
    const text = formatOutput({ ok: false, status: 'error', error: { code: 'X', message: 'bad' } }, true, true);
    expect(text).not.toContain('\u001B');
    expect(JSON.parse(text).error.code).toBe('X');
  });
  it('resolves color from flags, environment and the target stream', () => {
    expect(resolveColor('always', { isTTY: false }, {})).toBe(true);
    expect(resolveColor('never', { isTTY: true }, {})).toBe(false);
    expect(resolveColor(undefined, { isTTY: true }, {})).toBe(true);
    expect(resolveColor(undefined, { isTTY: false }, {})).toBe(false);
    expect(resolveColor(undefined, { isTTY: true }, { NO_COLOR: '1' })).toBe(false);
    expect(resolveColor(undefined, { isTTY: true }, { NO_COLOR: '' })).toBe(true);
    expect(resolveColor(undefined, { isTTY: false }, { FORCE_COLOR: '1' })).toBe(true);
    expect(resolveColor(undefined, { isTTY: true }, { FORCE_COLOR: '0' })).toBe(false);
    expect(resolveColor(undefined, { isTTY: true }, { FORCE_COLOR: 'false' })).toBe(false);
    expect(resolveColor(undefined, { isTTY: true }, { TERM: 'dumb' })).toBe(false);
    expect(resolveColor(undefined, { isTTY: false }, { NO_COLOR: '1', FORCE_COLOR: '1' })).toBe(true);
    expect(resolveColor('always', { isTTY: false }, { NO_COLOR: '1' })).toBe(true);
  });
});
