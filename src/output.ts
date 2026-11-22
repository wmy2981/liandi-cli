import { render } from './render.js';

export type OutputKind = 'success' | 'dry-run' | 'cancelled' | 'error';

/** CLI request for color; `auto` defers to the environment and the target stream. */
export type ColorMode = 'auto' | 'always' | 'never';

/** `human` renders for people, `json` is the stable envelope agents depend on. */
export type OutputFormat = 'human' | 'json';

export interface OutputEnvelope {
  ok: boolean;
  status: OutputKind;
  command?: string;
  data?: unknown;
  /** Optional guidance, e.g. the next step when 2FA is required. */
  hint?: string;
  error?: { code: string; message: string; details?: unknown };
}

export interface FormatOptions {
  format?: OutputFormat;
  color?: boolean;
  /** Terminal width used to lay out tables. */
  width?: number;
  /** Server the request went to, so rendered links can be absolute. */
  baseUrl?: string;
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

export function formatOutput(envelope: OutputEnvelope, options: FormatOptions = {}): string {
  const { format = 'human', color = false, width, baseUrl } = options;
  if (format === 'json') return JSON.stringify(envelope, null, 2);
  const paint = (code: string) => (text: string) => color ? `${code}${text}${ANSI.reset}` : text;
  if (envelope.status === 'error') {
    return paint(ANSI.red)(`Error [${envelope.error?.code}]: ${envelope.error?.message}`);
  }
  if (envelope.status === 'dry-run') {
    return `${paint(ANSI.yellow)('Dry run: no request was sent.')}\n${formatDryRun(envelope.data)}`;
  }
  if (envelope.status === 'cancelled') return paint(ANSI.yellow)('Cancelled: no request was sent.');
  const body = render(envelope.command, envelope.data, { width, baseUrl });
  return envelope.hint ? `${body}\n\n${paint(ANSI.cyan)(envelope.hint)}` : body;
}

/** A preview is the request that would be sent; show the target first, then the body. */
function formatDryRun(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return formatData(value);
  const preview = value as { method?: unknown; url?: unknown; body?: unknown; action?: unknown; destination?: unknown };
  if (typeof preview.method === 'string' && typeof preview.url === 'string') {
    const head = `${preview.method} ${preview.url}`;
    return preview.body === undefined ? head : `${head}\n${formatData(preview.body)}`;
  }
  return formatData(value);
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
