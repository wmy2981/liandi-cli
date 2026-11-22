import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  localizeErrorMessage,
  messages,
  normalizeLocaleTag,
  resolveLocale,
} from '../src/i18n.js';

describe('locale tag normalization', () => {
  it('maps Simplified Chinese, Traditional Chinese and English tags', () => {
    for (const tag of ['en', 'EN', 'en-US', 'en_GB', 'en_US.UTF-8']) {
      expect(normalizeLocaleTag(tag)).toBe('en');
    }
    for (const tag of ['zh', 'zh-CN', 'zh_CN', 'zh_CN.UTF-8', 'zh-Hans', 'zh-Hans-CN', 'zh-SG']) {
      expect(normalizeLocaleTag(tag)).toBe('zh-CN');
    }
    for (const tag of ['zh-TW', 'zh_TW', 'zh_TW.UTF-8', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-TW', 'zh_HK@euro']) {
      expect(normalizeLocaleTag(tag)).toBe('zh-TW');
    }
  });

  it('returns undefined for unsupported or blank tags', () => {
    for (const tag of [undefined, '', '   ', 'fr', 'ja-JP', 'C', 'POSIX']) {
      expect(normalizeLocaleTag(tag)).toBeUndefined();
    }
  });
});

describe('locale resolution priority', () => {
  it('follows --lang > LIANDI_LANG > LC_ALL > LC_MESSAGES > LANG > system > en', () => {
    expect(resolveLocale('zh-TW', { LIANDI_LANG: 'en', LC_ALL: 'zh_CN.UTF-8' }, 'en-US')).toBe('zh-TW');
    expect(resolveLocale(undefined, { LIANDI_LANG: 'zh-TW', LC_ALL: 'en_US.UTF-8' }, 'zh-CN')).toBe('zh-TW');
    expect(resolveLocale(undefined, { LC_ALL: 'zh_TW.UTF-8', LC_MESSAGES: 'zh_CN.UTF-8', LANG: 'en_US.UTF-8' }, 'en-US')).toBe('zh-TW');
    expect(resolveLocale(undefined, { LC_MESSAGES: 'zh_CN.UTF-8', LANG: 'zh_TW.UTF-8' }, 'en-US')).toBe('zh-CN');
    expect(resolveLocale(undefined, { LANG: 'zh_HK.UTF-8' }, 'en-US')).toBe('zh-TW');
    expect(resolveLocale(undefined, {}, 'zh-CN')).toBe('zh-CN');
    expect(resolveLocale(undefined, {}, 'zh-Hant-TW')).toBe('zh-TW');
    expect(resolveLocale(undefined, {}, 'en-US')).toBe('en');
    expect(resolveLocale(undefined, {}, 'fr-FR')).toBe(DEFAULT_LOCALE);
  });

  it('treats C/POSIX and unsupported POSIX env vars as English without leaking host locale', () => {
    expect(resolveLocale(undefined, { LC_ALL: 'C', LANG: 'zh_CN.UTF-8' }, 'zh-CN')).toBe('en');
    expect(resolveLocale(undefined, { LANG: 'POSIX' }, 'zh-TW')).toBe('en');
    expect(resolveLocale(undefined, { LANG: 'fr_FR.UTF-8' }, 'zh-CN')).toBe('en');
  });

  it('provides complete catalogs for all supported locales', () => {
    expect(SUPPORTED_LOCALES).toEqual(['en', 'zh-CN', 'zh-TW']);
    for (const locale of SUPPORTED_LOCALES) {
      const m = messages(locale);
      expect(m.help.description.length).toBeGreaterThan(0);
      expect(m.output.dryRun.length).toBeGreaterThan(0);
      expect(m.render.emptyArticles.length).toBeGreaterThan(0);
    }
  });
});

describe('human error localization', () => {
  const sampleErrors = [
    'Use either --json or --format human, not both',
    '--color must be auto, always or never',
    '--format must be human or json',
    '--lang must be en, zh-CN or zh-TW',
    '--yes only applies to write operations; omit it for reads',
    '--dry-run only applies to write operations; omit it for reads',
    '--token requires a value',
    '--yes does not take a value',
    'API token required. Set --token, LIANDI_TOKEN, ./.env, or ~/.config/liandi/.env',
    'Confirmation required in a non-interactive terminal. Review with --dry-run, then rerun with --yes',
    'Request failed with HTTP 502',
    'Server returned non-JSON response (HTTP 500)',
    'Request timed out after 30000ms',
    'Network request failed',
    'API returned code 1',
    'Expected an integer, received: abc',
    'Integer out of range: 99999999999999999999',
    'Article ID cannot be empty',
    'Tag cannot be "." or ".."',
    'Cannot read local configuration',
    'Cannot read content file: post.md',
    'Cannot install the liandi skill: EACCES',
    "unknown command 'bogus'",
    "unknown option '--nope'",
    "required option '--title <title>' not specified",
    "missing required argument 'id'",
    "option '-p, --page <page>' argument missing",
    "too many arguments for 'time'. Expected 0 arguments but got 1.",
  ];

  it('keeps English messages untouched and translates them for zh-CN and zh-TW', () => {
    for (const sample of sampleErrors) {
      expect(localizeErrorMessage(sample, 'en')).toBe(sample);
      const cn = localizeErrorMessage(sample, 'zh-CN');
      const tw = localizeErrorMessage(sample, 'zh-TW');
      expect(cn, `missing zh-CN translation for: ${sample}`).not.toBe(sample);
      expect(tw, `missing zh-TW translation for: ${sample}`).not.toBe(sample);
    }
  });

  it('passes upstream or unknown error messages through unchanged', () => {
    expect(localizeErrorMessage('内容太短', 'zh-CN')).toBe('内容太短');
    expect(localizeErrorMessage('内容太短', 'zh-TW')).toBe('内容太短');
    expect(localizeErrorMessage('stdout is gone', 'zh-CN')).toBe('stdout is gone');
  });
});
