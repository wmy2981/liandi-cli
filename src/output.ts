export type OutputKind = 'success' | 'dry-run' | 'cancelled' | 'error';

export interface OutputEnvelope {
  ok: boolean;
  status: OutputKind;
  command?: string;
  data?: unknown;
  error?: { code: string; message: string; details?: unknown };
}

export function formatOutput(envelope: OutputEnvelope, json: boolean): string {
  if (json) return JSON.stringify(envelope, null, 2);
  if (envelope.status === 'error') return `Error [${envelope.error?.code}]: ${envelope.error?.message}`;
  if (envelope.status === 'dry-run') return `Dry run: no request was sent.\n${formatData(envelope.data)}`;
  if (envelope.status === 'cancelled') return 'Cancelled: no request was sent.';
  return formatData(envelope.data);
}

function formatData(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2);
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    /^(?:token|userPassword|twofactorAuthCode|authorization|cookie)$/iu.test(key) ? '[REDACTED]' : redact(item),
  ]));
}
