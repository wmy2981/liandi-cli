export class LiandiError extends Error {
  constructor(
    message: string,
    readonly code = 'ERROR',
    readonly exitCode = 1,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'LiandiError';
  }
}

export class ApiError extends LiandiError {
  constructor(
    message: string,
    readonly status: number,
    readonly response?: unknown,
  ) {
    super(message, status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : 'API_ERROR', 1, response);
    this.name = 'ApiError';
  }
}
