import { cpSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../dist/skills/liandi/', import.meta.url));
mkdirSync(target, { recursive: true });
cpSync(new URL('../skills/liandi/', import.meta.url), target, { recursive: true });
