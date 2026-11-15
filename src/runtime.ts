import { createInterface } from 'node:readline/promises';
import { stdin, stdout, stderr } from 'node:process';
import { LiandiClient, type ApiRequest } from './client.js';
import { LiandiError } from './errors.js';
import { formatOutput, redact, type OutputEnvelope } from './output.js';

export interface GlobalOptions {
  token?: string;
  baseUrl?: string;
  json?: boolean;
  dryRun?: boolean;
  yes?: boolean;
}

export interface IO {
  stdout: { write(text: string): unknown; isTTY?: boolean };
  stderr: { write(text: string): unknown; isTTY?: boolean };
  stdin: { isTTY?: boolean };
  confirm?: (prompt: string) => Promise<string>;
}

export const defaultIO: IO = { stdout, stderr, stdin };

/** Upstream business errors arrive as HTTP 200 with a non-zero JSON code. */
export function upstreamFailure(data: unknown): { code: number; msg: string } | undefined {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const code = Number((data as { code?: unknown }).code);
  if (!Number.isFinite(code) || code === 0) return undefined;
  const msg = (data as { msg?: unknown }).msg;
  return { code, msg: typeof msg === 'string' ? msg : '' };
}

export interface OperationOptions {
  write?: boolean;
  /** The endpoint requires a login, so reject locally when no token exists. */
  auth?: boolean;
  /** The request carries its own credential flow (login/2FA). */
  suppressAuth?: boolean;
}

export async function execute(
  command: string,
  request: ApiRequest,
  globals: GlobalOptions,
  io: IO,
  version: string,
  env: NodeJS.ProcessEnv = process.env,
  options: OperationOptions = {},
): Promise<OutputEnvelope> {
  const client = new LiandiClient({ baseUrl: globals.baseUrl ?? env.LIANDI_BASE_URL ?? 'https://ld246.com', version, token: globals.token });
  const preview = () => redact({
    method: request.method,
    url: client.url(request),
    ...(request.body === undefined ? {} : { body: request.body }),
  });
  if (options.write) {
    if (globals.dryRun) return { ok: true, status: 'dry-run', command, data: preview() };
    if (!globals.yes) {
      io.stdout.write(formatOutput({ ok: true, status: 'dry-run', command, data: preview() }, globals.json ?? false) + '\n');
      if (!io.stdin.isTTY || !io.stdout.isTTY) {
        throw new LiandiError('Confirmation required in a non-interactive terminal. Review with --dry-run, then rerun with --yes', 'CONFIRMATION_REQUIRED', 2);
      }
      const confirm = io.confirm ?? (async (prompt: string) => {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        try { return await rl.question(prompt); } finally { rl.close(); }
      });
      const answer = await confirm('Execute this operation? [y/N] ');
      if (!/^y(?:es)?$/iu.test(answer.trim())) return { ok: true, status: 'cancelled', command };
    }
    const data = await client.call(request, { auth: options.auth, suppressAuth: options.suppressAuth });
    return settle(command, data);
  }
  if (globals.dryRun) throw new LiandiError('--dry-run only applies to write operations; omit it for reads', 'INVALID_INPUT', 2);
  const data = await client.call(request, { auth: options.auth, suppressAuth: options.suppressAuth });
  return settle(command, data);
}

/**
 * code 10 means "two-factor required": it is an intermediate login step, not a
 * failure, and its session token is what the 2fa command consumes next.
 */
function settle(command: string, data: unknown): OutputEnvelope {
  const failure = upstreamFailure(data);
  if (!failure) return { ok: true, status: 'success', command, data };
  if (command === 'auth.login' && failure.code === 10) {
    return {
      ok: true, status: 'success', command, data,
      hint: 'Two-factor required: run "liandi auth 2fa --session-token <token> --code <6 digits>"',
    };
  }
  throw new LiandiError(failure.msg || `API returned code ${failure.code}`, `API_CODE_${failure.code}`, 1, redact(data));
}

export function errorEnvelope(error: unknown, command?: string): OutputEnvelope {
  const known = error instanceof LiandiError;
  return {
    ok: false,
    status: 'error',
    ...(command ? { command } : {}),
    error: {
      code: known ? error.code : 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      ...(known && error.details !== undefined ? { details: error.details } : {}),
    },
  };
}
