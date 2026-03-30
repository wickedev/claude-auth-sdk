import type { StorageAdapter, StoredCredentialEnvelope } from '../../core/contracts.js';
import type { StorageFailureError } from '../../core/errors.js';

export type CompatOAuthRefreshModeId = 'claudeai' | 'console';

export interface CompatOAuthRefreshRequest {
  readonly refreshToken: string;
  readonly clientId: string;
  readonly scope?: readonly string[];
  readonly modeId?: CompatOAuthRefreshModeId;
  readonly tokenEndpoint?: string;
}

export interface CompatOAuthRefreshOptions {
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
}

export interface CompatOAuthRefreshResponse {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt: number;
  readonly scopes: readonly string[];
}

export interface EnsureFreshCompatOAuthRequest {
  readonly storage: StorageAdapter;
  readonly clientId: string;
  readonly modeId?: CompatOAuthRefreshModeId;
  readonly tokenEndpoint?: string;
  readonly earlyRefreshWindowMs?: number;
}

export interface EnsureFreshCompatOAuthOptions extends CompatOAuthRefreshOptions {
  readonly envelope?: StoredCredentialEnvelope;
}

export type EnsureFreshCompatOAuthResult =
  | {
      readonly ok: true;
      readonly status: 'unchanged' | 'refreshed';
      readonly refreshAttempted: boolean;
      readonly rotatedRefreshToken: boolean;
      readonly envelope: StoredCredentialEnvelope;
    }
  | {
      readonly ok: false;
      readonly reason:
        | 'missing-credentials'
        | 'non-compat-oauth'
        | 'missing-refresh-token'
        | 'refresh-failed'
        | 'storage-write-failed';
      readonly refreshAttempted: boolean;
      readonly envelope?: StoredCredentialEnvelope;
      readonly error?: Error | StorageFailureError;
    };

export interface ResolveAuthHeadersRequest {
  readonly storage: StorageAdapter;
  readonly refresh?: {
    readonly clientId: string;
    readonly modeId?: CompatOAuthRefreshModeId;
    readonly tokenEndpoint?: string;
    readonly earlyRefreshWindowMs?: number;
  };
}

export interface ResolveAuthHeadersOptions extends CompatOAuthRefreshOptions {
  readonly envelope?: StoredCredentialEnvelope;
}

export type ResolveAuthHeadersResult =
  | {
      readonly ok: true;
      readonly source: 'oauth-bearer' | 'api-key';
      readonly refreshed: boolean;
      readonly headers: Readonly<Record<string, string>>;
      readonly envelope: StoredCredentialEnvelope;
    }
  | {
      readonly ok: false;
      readonly reason:
        | 'missing-credentials'
        | 'oauth-expired'
        | 'missing-refresh-token'
        | 'oauth-refresh-failed'
        | 'unsupported-terminal-state';
      readonly headers: Readonly<Record<string, string>>;
      readonly envelope?: StoredCredentialEnvelope;
      readonly refreshResult?: EnsureFreshCompatOAuthResult;
    };
