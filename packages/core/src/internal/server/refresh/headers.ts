import { ensureFreshCompatOAuthCredentials, isOAuthCredentialExpired } from './refresh.js';
import type {
  ResolveAuthHeadersOptions,
  ResolveAuthHeadersRequest,
  ResolveAuthHeadersResult,
} from './types.js';

export async function resolveLaneAwareAuthHeaders(
  request: ResolveAuthHeadersRequest,
  options: ResolveAuthHeadersOptions = {},
): Promise<ResolveAuthHeadersResult> {
  const envelope = options.envelope ?? (await request.storage.read());
  const expiryCheckOptions = {
    now: options.now,
    earlyRefreshWindowMs: request.refresh?.earlyRefreshWindowMs,
  };

  if (envelope === null) {
    return {
      ok: false,
      reason: 'missing-credentials',
      headers: {},
    };
  }

  if (envelope.terminal.mode === 'api-key') {
    return {
      ok: true,
      source: 'api-key',
      refreshed: false,
      headers: {
        'x-api-key': envelope.terminal.apiKey,
      },
      envelope,
    };
  }

  if (envelope.terminal.mode === 'official-provider') {
    if (isOAuthCredentialExpired(envelope.terminal.credentials, expiryCheckOptions)) {
      return {
        ok: false,
        reason: 'oauth-expired',
        headers: {},
        envelope,
      };
    }

    return {
      ok: true,
      source: 'oauth-bearer',
      refreshed: false,
      headers: {
        Authorization: `Bearer ${envelope.terminal.credentials.accessToken}`,
      },
      envelope,
    };
  }

  if (!isOAuthCredentialExpired(envelope.terminal.credentials, expiryCheckOptions)) {
    return {
      ok: true,
      source: 'oauth-bearer',
      refreshed: false,
      headers: {
        Authorization: `Bearer ${envelope.terminal.credentials.accessToken}`,
      },
      envelope,
    };
  }

  if (request.refresh === undefined) {
    return {
      ok: false,
      reason: 'oauth-expired',
      headers: {},
      envelope,
    };
  }

  const refreshResult = await ensureFreshCompatOAuthCredentials(
    {
      storage: request.storage,
      clientId: request.refresh.clientId,
      modeId: request.refresh.modeId,
      tokenEndpoint: request.refresh.tokenEndpoint,
      earlyRefreshWindowMs: request.refresh.earlyRefreshWindowMs,
    },
    {
      fetchImpl: options.fetchImpl,
      now: options.now,
      envelope,
    },
  );

  if (!refreshResult.ok) {
    if (refreshResult.reason === 'missing-refresh-token') {
      return {
        ok: false,
        reason: 'missing-refresh-token',
        headers: {},
        envelope,
        refreshResult,
      };
    }

    return {
      ok: false,
      reason: 'oauth-refresh-failed',
      headers: {},
      envelope,
      refreshResult,
    };
  }

  if (refreshResult.envelope.terminal.mode !== 'compat-oauth') {
    return {
      ok: false,
      reason: 'unsupported-terminal-state',
      headers: {},
      envelope,
      refreshResult,
    };
  }

  return {
    ok: true,
    source: 'oauth-bearer',
    refreshed: refreshResult.status === 'refreshed',
    headers: {
      Authorization: `Bearer ${refreshResult.envelope.terminal.credentials.accessToken}`,
    },
    envelope: refreshResult.envelope,
  };
}
