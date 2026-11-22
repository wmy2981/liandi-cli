#!/usr/bin/env node
/**
 * Packaging smoke test: build the tarball, install it the way npm users will,
 * and run the installed binary. This catches files missing from `files`, a
 * broken `bin` entry, or assumptions about the current working directory.
 *
 *   node scripts/pack-check.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'liandi-pack-'));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
// Windows exposes npm as a .cmd shim, which Node refuses to spawn without a shell.
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const quote = value => (/[\s"]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
const run = (command, args, options = {}) => {
  const base = { stdio: 'pipe', encoding: 'utf8', ...options };
  if (command === npm && process.platform === 'win32') {
    return execFileSync([command, ...args].map(quote).join(' '), { ...base, shell: true });
  }
  return execFileSync(command, args, base);
};

console.log('1. building');
run(npm, ['run', 'build'], { cwd: root });

console.log('2. packing');
const packOutput = run(npm, ['pack', '--pack-destination', work], { cwd: root });
const tarball = join(work, packOutput.trim().split('\n').at(-1));
if (!existsSync(tarball)) throw new Error(`tarball not created: ${tarball}`);

const entries = run('tar', ['-tzf', tarball]).split('\n').map(entry => entry.trim()).filter(Boolean);
for (const required of ['package/dist/cli.js', 'package/dist/skills/liandi/SKILL.md', 'package/dist/skills/liandi/references/commands.md', 'package/package.json']) {
  if (!entries.includes(required)) throw new Error(`tarball is missing ${required}`);
}
if (entries.some(entry => entry.startsWith('package/src/'))) throw new Error('tarball should not ship TypeScript sources');
if (entries.some(entry => entry.includes('node_modules'))) throw new Error('tarball should not ship node_modules');

console.log('3. installing into an isolated prefix');
const prefix = join(work, 'prefix');
run(npm, ['install', '--prefix', prefix, '--no-audit', '--no-fund', tarball], { cwd: work });
const installed = join(prefix, 'node_modules', 'liandi', 'dist', 'cli.js');
if (!existsSync(installed)) throw new Error('installed CLI is missing');

console.log('4. running the installed CLI');
const version = run(process.execPath, [installed, '--version'], { cwd: work }).trim();
if (version !== pkg.version) throw new Error(`version output ${version} != package.json ${pkg.version}`);
const help = run(process.execPath, [installed, '--help'], { cwd: work });
for (const group of ['article', 'comment', 'user', 'notice', 'time']) {
  if (!help.includes(group)) throw new Error(`help is missing ${group}`);
}

const env = { ...process.env, LIANDI_TOKEN: 'pack-check', LIANDI_BASE_URL: 'http://127.0.0.1:1' };
const preview = JSON.parse(run(process.execPath, [installed, 'article', 'post', '--title', 't', '--tags', 'a', '-c', 'x', '-d', '-j'], { cwd: work, env }));
if (preview.status !== 'dry-run') throw new Error('dry run did not preview');
if (!preview.data.url.endsWith('/api/v2/article')) throw new Error(`unexpected url ${preview.data.url}`);

const home = join(work, 'home');
const installedSkill = JSON.parse(run(process.execPath, [installed, 'skill', 'install', '-y', '-j'], { cwd: work, env: { ...env, HOME: home, USERPROFILE: home } }));
if (!existsSync(join(home, '.agents', 'skills', 'liandi', 'SKILL.md'))) throw new Error(`skill install failed: ${installedSkill.data?.destination}`);

const binDir = join(prefix, 'node_modules', '.bin');
console.log(`5. ok — tarball ${tarball.split('/').pop()}, bin dir ${readdirSync(binDir).join(', ')}`);
