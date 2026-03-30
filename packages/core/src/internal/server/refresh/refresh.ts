import { RefreshFailureError, StorageFailureError } from '../../core/errors.js';
import type { CompatOAuthTerminalState, OAuthCredentialBundle } from '../../core/types.js';
import type {
  CompatOAuthRefreshModeId,
  CompatOAuthRefreshOptions,
  CompatOAuthRefreshRequest,
  CompatOAuthRefreshResponse,
  EnsureFreshCompatOAuthOptions,
  EnsureFreshCompatOAuthRequest,
  EnsureFreshCompatOAuthResult,
} from './types.js';

const DEFAULT_COMPAT_REFRESH_TOKEN_ENDPOINTS: Readonly<Record<CompatOAuthRefreshModeId, string>> = {
  claudeai: 'https://platform.claude.com/v1/oauth/token',
  console: 'https://platform.claude.com/v1/oauth/token',
};

const DEFAULT_EARLY_REFRESH_WINDOW_MS = 5 * 60 * 1000;

export function isOAuthCredentialExpired(
  credentials: OAuthCredentialBundle,
  options: {
    readonly now?: () => number;
    readonly earlyRefreshWindowMs?: number;
  } = {},
): boolean {
  const now = options.now ?? Date.now;
  const earlyRefreshWindowMs = options.earlyRefreshWindowMs ?? DEFAULT_EARLY_REFRESH_WINDOW_MS;

  return now() >= credentials.expiresAt - earlyRefreshWindowMs;
}

export function resolveCompatRefreshModeId(
  terminal: CompatOAuthTerminalState,
): CompatOAuthRefreshModeId {
  return terminal.providerKey === 'console' ? 'console' : 'claudeai';
}

export async function refreshCompatOAuthAccessToken(
  request: CompatOAuthRefreshRequest,
  options: CompatOAuthRefreshOptions = {},
): Promise<CompatOAuthRefreshResponse> {
  const refreshToken = request.refreshToken.trim();
  if (refreshToken.length === 0) {
    throw new RefreshFailureError(
      'Cannot refresh compat OAuth credentials without a refresh token.',
    );
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const modeId = request.modeId ?? 'claudeai';
  const endpoint = request.tokenEndpoint ?? DEFAULT_COMPAT_REFRESH_TOKEN_ENDPOINTS[modeId];
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: request.clientId,
    }),
  });

  const payload = await tryReadJson(response);
  if (!response.ok) {
    const message =
      readStringField(payload, 'error_description') ??
      readStringField(payload, 'error') ??
      `OAuth refresh failed with HTTP ${response.status}.`;
    throw new RefreshFailureError(message);
  }

  const nextAccessToken = readStringField(payload, 'access_token');
  if (nextAccessToken === undefined || nextAccessToken.length === 0) {
    throw new RefreshFailureError('Refresh response did not include access_token.');
  }

  const expiresInSeconds = coerceExpiresInSeconds(payload.expires_in);
  const scopeFromResponse = readStringField(payload, 'scope');
  const scopes =
    scopeFromResponse === undefined ? (request.scope ?? []) : splitScope(scopeFromResponse);
  const nextRefreshToken = readStringField(payload, 'refresh_token');

  return {
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    expiresAt: now() + expiresInSeconds * 1000,
    scopes,
  };
}

export async function ensureFreshCompatOAuthCredentials(
  request: EnsureFreshCompatOAuthRequest,
  options: EnsureFreshCompatOAuthOptions = {},
): Promise<EnsureFreshCompatOAuthResult> {
  const now = options.now ?? Date.now;
  const envelope = options.envelope ?? (await request.storage.read());

  if (envelope === null) {
    return {
      ok: false,
      reason: 'missing-credentials',
      refreshAttempted: false,
    };
  }

  if (envelope.terminal.mode !== 'compat-oauth') {
    return {
      ok: false,
      reason: 'non-compat-oauth',
      refreshAttempted: false,
      envelope,
    };
  }

  if (
    !isOAuthCredentialExpired(envelope.terminal.credentials, {
      now,
      earlyRefreshWindowMs: request.earlyRefreshWindowMs,
    })
  ) {
    return {
      ok: true,
      status: 'unchanged',
      refreshAttempted: false,
      rotatedRefreshToken: false,
      envelope,
    };
  }

  const currentRefreshToken = envelope.terminal.credentials.refreshToken.trim();
  if (currentRefreshToken.length === 0) {
    return {
      ok: false,
      reason: 'missing-refresh-token',
      refreshAttempted: false,
      envelope,
    };
  }

  try {
    const refreshResult = await refreshCompatOAuthAccessToken(
      {
        refreshToken: currentRefreshToken,
        clientId: request.clientId,
        modeId: request.modeId ?? resolveCompatRefreshModeId(envelope.terminal),
        tokenEndpoint: request.tokenEndpoint,
        scope: envelope.terminal.credentials.scopes,
      },
      {
        fetchImpl: options.fetchImpl,
        now,
      },
    );

    const hasRotatedToken =
      refreshResult.refreshToken !== undefined &&
      refreshResult.refreshToken.trim().length > 0 &&
      refreshResult.refreshToken !== envelope.terminal.credentials.refreshToken;

    const nextEnvelope = {
      terminal: {
        ...envelope.terminal,
        credentials: {
          ...envelope.terminal.credentials,
          accessToken: refreshResult.accessToken,
          refreshToken:
            refreshResult.refreshToken !== undefined && refreshResult.refreshToken.trim().length > 0
              ? refreshResult.refreshToken
              : envelope.terminal.credentials.refreshToken,
          expiresAt: refreshResult.expiresAt,
          scopes: refreshResult.scopes,
        },
      },
      updatedAt: now(),
    };

    try {
      await request.storage.write(nextEnvelope);
    } catch (error) {
      return {
        ok: false,
        reason: 'storage-write-failed',
        refreshAttempted: true,
        envelope,
        error:
          error instanceof StorageFailureError
            ? error
            : new StorageFailureError('Failed to persist refreshed OAuth credentials.', error),
      };
    }

    return {
      ok: true,
      status: 'refreshed',
      refreshAttempted: true,
      rotatedRefreshToken: hasRotatedToken,
      envelope: nextEnvelope,
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'refresh-failed',
      refreshAttempted: true,
      envelope,
      error:
        error instanceof RefreshFailureError
          ? error
          : new RefreshFailureError('Failed to refresh compat OAuth credentials.', error),
    };
  }
}

function splitScope(scope: string): string[] {
  const normalized = scope.trim();
  if (normalized.length === 0) {
    return [];
  }

  return normalized.split(/\s+/);
}

function readStringField(payload: unknown, key: string): string | undefined {
  if (payload === null || typeof payload !== 'object' || !(key in payload)) {
    return undefined;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function coerceExpiresInSeconds(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return 0;
}

async function tryReadJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload = (await response.json()) as unknown;
    if (payload !== null && typeof payload === 'object') {
      return payload as Record<string, unknown>;
    }

    return {};
  } catch {
    return {};
  }
}
