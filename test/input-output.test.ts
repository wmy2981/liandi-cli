import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { boolean, content, contentType, positiveInteger, size } from '../src/input.js';
import { formatOutput, redact } from '../src/output.js';

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
});

describe('output', () => {
  it('uses one JSON envelope and redacts credentials', () => {
    const result = JSON.parse(formatOutput({ ok: true, status: 'success', command: 'test', data: { code: 0 } }, true));
    expect(result).toEqual({ ok: true, status: 'success', command: 'test', data: { code: 0 } });
    expect(redact({ token: 'x', userPassword: 'y', nested: { twofactorAuthCode: '123456' }, title: 'ok' })).toEqual({ token: '[REDACTED]', userPassword: '[REDACTED]', nested: { twofactorAuthCode: '[REDACTED]' }, title: 'ok' });
  });
  it('makes dry-run and cancellation explicit in human output', () => {
    expect(formatOutput({ ok: true, status: 'dry-run', data: { method: 'POST' } }, false)).toContain('no request was sent');
    expect(formatOutput({ ok: true, status: 'cancelled' }, false)).toContain('Cancelled');
    expect(formatOutput({ ok: false, status: 'error', error: { code: 'X', message: 'bad' } }, false)).toBe('Error [X]: bad');
  });
});
