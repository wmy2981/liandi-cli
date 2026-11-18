export type OutputKind = 'success' | 'dry-run' | 'cancelled' | 'error';

/** CLI request for color; `auto` defers to the environment and the target stream. */
export type ColorMode = 'auto' | 'always' | 'never';

export interface OutputEnvelope {
  ok: boolean;
  status: OutputKind;
  command?: string;
  data?: unknown;
  /** Optional guidance, e.g. the next step when 2FA is required. */
  hint?: string;
  error?: { code: string; message: string; details?: unknown };
}

const ANSI = { red: '\u001B[31m', yellow: '\u001B[33m', cyan: '\u001B[36m', reset: '\u001B[39m' } as const;

/**
 * Explicit flags win, then the de-facto environment conventions. FORCE_COLOR is
 * checked first, matching Node and chalk: a deliberate force request beats a
 * broad NO_COLOR opt-out.
 */
export function resolveColor(
  mode: ColorMode | undefined,
  stream: { isTTY?: boolean },
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  if (env.FORCE_COLOR !== undefined) {
    const force = env.FORCE_COLOR.toLowerCase();
    if (force === '0' || force === 'false') return false;
    return true;
  }
  if (env.NO_COLOR) return false;
  if (env.TERM === 'dumb') return false;
  return Boolean(stream.isTTY);
}

export function formatOutput(envelope: OutputEnvelope, json: boolean, color = false): string {
  if (json) return JSON.stringify(envelope, null, 2);
  const paint = (code: string) => (text: string) => color ? `${code}${text}${ANSI.reset}` : text;
  if (envelope.status === 'error') {
    return paint(ANSI.red)(`Error [${envelope.error?.code}]: ${envelope.error?.message}`);
  }
  if (envelope.status === 'dry-run') {
    return `${paint(ANSI.yellow)('Dry run: no request was sent.')}\n${formatData(envelope.data)}`;
  }
  if (envelope.status === 'cancelled') return paint(ANSI.yellow)('Cancelled: no request was sent.');
  return envelope.hint ? `${formatData(envelope.data)}\n\n${paint(ANSI.cyan)(envelope.hint)}` : formatData(envelope.data);
}

function formatData(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2);
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    /^(?:userPassword|twofactorAuthCode|authorization|cookie)$/iu.test(key) ? '[REDACTED]' : redact(item),
  ]));
}
