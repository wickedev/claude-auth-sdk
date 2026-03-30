import type { AuthMode } from './types.js';

export type ClaudeAuthErrorCode =
  | 'INVALID_STATE'
  | 'MISSING_CODE'
  | 'UNSUPPORTED_RUNTIME'
  | 'POLICY_GATED_MODE'
  | 'REFRESH_FAILURE'
  | 'STORAGE_FAILURE';

export class ClaudeAuthError extends Error {
  public readonly code: ClaudeAuthErrorCode;

  public constructor(message: string, code: ClaudeAuthErrorCode, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.code = code;
  }
}

export class InvalidStateError extends ClaudeAuthError {
  public readonly expectedState: string;
  public readonly receivedState: string | undefined;

  public constructor(params: { expectedState: string; receivedState?: string }) {
    const { expectedState, receivedState } = params;
    super(
      `OAuth state validation failed (expected "${expectedState}", received "${receivedState ?? 'undefined'}").`,
      'INVALID_STATE',
    );
    this.expectedState = expectedState;
    this.receivedState = receivedState;
  }
}

export class MissingAuthorizationCodeError extends ClaudeAuthError {
  public constructor(message = 'Missing authorization code in callback payload.') {
    super(message, 'MISSING_CODE');
  }
}

export class UnsupportedRuntimeError extends ClaudeAuthError {
  public readonly runtime: string;

  public constructor(runtime: string, message?: string) {
    super(message ?? `Unsupported runtime: ${runtime}.`, 'UNSUPPORTED_RUNTIME');
    this.runtime = runtime;
  }
}

export class PolicyGatedModeError extends ClaudeAuthError {
  public readonly mode: AuthMode;

  public constructor(mode: AuthMode, reason?: string) {
    super(
      reason === undefined
        ? `Authentication mode "${mode}" is disabled by policy.`
        : `Authentication mode "${mode}" is disabled by policy: ${reason}`,
      'POLICY_GATED_MODE',
    );
    this.mode = mode;
  }
}

export class RefreshFailureError extends ClaudeAuthError {
  public constructor(message = 'Failed to refresh authentication credentials.', cause?: unknown) {
    super(message, 'REFRESH_FAILURE', cause);
  }
}

export class StorageFailureError extends ClaudeAuthError {
  public constructor(message = 'Failed to access credential storage.', cause?: unknown) {
    super(message, 'STORAGE_FAILURE', cause);
  }
}
