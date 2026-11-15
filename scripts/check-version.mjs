#!/usr/bin/env node
/**
 * Version consistency gate.
 *
 *   node scripts/check-version.mjs              # package.json vs package-lock.json
 *   node scripts/check-version.mjs v1.2.3       # also require tag === version
 *
 * Exit code 1 with a plain message when a rule is violated, so CI output stays readable.
 */
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, root), 'utf8'));
const fail = message => {
  console.error(`version check failed: ${message}`);
  process.exit(1);
};

const pkg = read('package.json');
const version = pkg.version;
if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version)) {
  fail(`package.json version "${version}" is not semver (expected MAJOR.MINOR.PATCH)`);
}
if (version.startsWith('0.0.0')) fail('0.0.0 is a placeholder, choose a real version');

let lock;
try {
  lock = read('package-lock.json');
} catch {
  fail('package-lock.json is missing; run npm install');
}
if (lock.version !== version) fail(`package-lock.json version ${lock.version} != package.json ${version}`);
if (lock.packages?.['']?.version !== version) {
  fail(`package-lock.json packages[""].version ${lock.packages?.['']?.version} != package.json ${version}`);
}
if (pkg.name !== lock.name || pkg.name !== lock.packages?.['']?.name) {
  fail(`package name mismatch: package.json ${pkg.name}, lock ${lock.name}/${lock.packages?.['']?.name}`);
}
if (!pkg.bin?.liandi) fail('package.json must expose a "liandi" bin entry');

const tag = process.argv[2];
if (tag !== undefined) {
  const expected = `v${version}`;
  if (tag !== expected) fail(`tag ${tag} does not match package version; expected ${expected}`);
}

console.log(`version ok: ${pkg.name}@${version}${tag ? ` (tag ${tag})` : ''}`);
