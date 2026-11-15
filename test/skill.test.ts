import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { installSkill, skillPaths } from '../src/skill.js';

describe('skill installer', () => {
  it('finds the bundled skill in the repository', async () => {
    expect(await readFile(join(skillPaths().source, 'SKILL.md'), 'utf8')).toContain('name: liandi');
  });

  it('replaces an existing installation and removes stale files', async () => {
    const home = await mkdtemp(join(tmpdir(), 'liandi-skill-home-'));
    const destination = join(home, '.agents', 'skills', 'liandi');
    await mkdir(destination, { recursive: true });
    await writeFile(join(destination, 'stale.txt'), 'old version file');

    const result = await installSkill(home);

    expect(result.destination).toBe(destination);
    expect(await readFile(join(destination, 'SKILL.md'), 'utf8')).toContain('name: liandi');
    expect(await readFile(join(destination, 'references', 'commands.md'), 'utf8')).toContain('liandi article list');
    await expect(readFile(join(destination, 'stale.txt'), 'utf8')).rejects.toThrow();
  });
});
