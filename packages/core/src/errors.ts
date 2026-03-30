export type LoginErrorCode = 'timeout' | 'cancelled' | 'exchange_failed' | 'storage_failed';

export class LoginError extends Error {
  public readonly code: LoginErrorCode;

  public constructor(message: string, code: LoginErrorCode, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'LoginError';
    this.code = code;
  }
}
