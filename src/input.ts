import { readFile } from 'node:fs/promises';
import { LiandiError } from './errors.js';

export async function content(inline?: string, file?: string): Promise<string> {
  if (inline !== undefined && file !== undefined) {
    throw new LiandiError('Use either --content or --content-file, not both', 'INVALID_INPUT', 2);
  }
  if (inline !== undefined) return inline;
  if (file === undefined) throw new LiandiError('Provide --content <text> or --content-file <path>', 'INVALID_INPUT', 2);
  try {
    return await readFile(file, 'utf8');
  } catch {
    throw new LiandiError(`Cannot read content file: ${file}`, 'INVALID_INPUT', 2);
  }
}

export function integer(value: string): number {
  if (!/^-?\d+$/u.test(value)) throw new LiandiError(`Expected an integer, received: ${value}`, 'INVALID_INPUT', 2);
  return Number(value);
}

export function positiveInteger(value: string): number {
  const parsed = integer(value);
  if (parsed < 1) throw new LiandiError('Expected an integer greater than zero', 'INVALID_INPUT', 2);
  return parsed;
}

export function size(value: string): number {
  const parsed = positiveInteger(value);
  if (parsed > 64) throw new LiandiError('Size must be between 1 and 64', 'INVALID_INPUT', 2);
  return parsed;
}

export function contentType(value: string): 'markdown' | 'html' {
  if (value !== 'markdown' && value !== 'html') {
    throw new LiandiError('Content type must be markdown or html', 'INVALID_INPUT', 2);
  }
  return value;
}

export function boolean(value: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new LiandiError('Expected true or false', 'INVALID_INPUT', 2);
}

export function encodeSegment(value: string, label: string): string {
  if (!value) throw new LiandiError(`${label} cannot be empty`, 'INVALID_INPUT', 2);
  return encodeURIComponent(value);
}
