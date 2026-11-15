import { cp, mkdir, rename, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LiandiError } from './errors.js';

export function skillPaths(home = homedir()): { source: string; destination: string } {
  const compiled = fileURLToPath(new URL('./skills/liandi/', import.meta.url));
  const source = existsSync(compiled) ? compiled : join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'liandi');
  return { source, destination: join(home, '.agents', 'skills', 'liandi') };
}

export async function installSkill(home?: string): Promise<{ destination: string; files: string[] }> {
  const { source, destination } = skillPaths(home);
  try {
    if (!(await stat(source)).isDirectory()) throw new Error('not a directory');
  } catch {
    throw new LiandiError('Bundled liandi skill is missing. Reinstall the liandi package', 'INSTALL_ERROR');
  }
  const parent = join(destination, '..');
  const temporary = join(parent, `.liandi-${process.pid}-${Date.now()}`);
  await mkdir(parent, { recursive: true });
  try {
    await cp(source, temporary, { recursive: true });
    await rm(destination, { recursive: true, force: true });
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  return { destination, files: ['SKILL.md', 'references/commands.md', 'evals/evals.json'] };
}
