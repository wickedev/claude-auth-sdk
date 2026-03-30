import { resolveLaneAwareAuthHeaders } from '../server/refresh/headers.js';
import {
  ensureFreshCompatOAuthCredentials,
  refreshCompatOAuthAccessToken,
} from '../server/refresh/refresh.js';
import type {
  CompatOAuthRefreshOptions,
  CompatOAuthRefreshRequest,
  EnsureFreshCompatOAuthOptions,
  EnsureFreshCompatOAuthRequest,
  ResolveAuthHeadersOptions,
  ResolveAuthHeadersRequest,
} from '../server/refresh/types.js';
import {
  type CompatModeId,
  type CompatRuntimeConfigOverrides,
  createCompatRuntimeConfig,
} from './config.js';

function resolveModeId(modeId: CompatModeId | undefined): CompatModeId {
  return modeId ?? 'claudeai';
}

export async function refreshCompatAccessToken(
  request: CompatOAuthRefreshRequest,
  options: CompatOAuthRefreshOptions = {},
  configOverrides: CompatRuntimeConfigOverrides = {},
) {
  const config = createCompatRuntimeConfig(configOverrides);
  const modeId = resolveModeId(request.modeId);

  return refreshCompatOAuthAccessToken(
    {
      ...request,
      modeId,
      clientId: request.clientId,
      scope: request.scope ?? config.constants.scope,
      tokenEndpoint: request.tokenEndpoint ?? config.endpoints.token[modeId],
    },
    options,
  );
}

export async function ensureFreshCompatCredentials(
  request: EnsureFreshCompatOAuthRequest,
  options: EnsureFreshCompatOAuthOptions = {},
  configOverrides: CompatRuntimeConfigOverrides = {},
) {
  const config = createCompatRuntimeConfig(configOverrides);
  const modeId = resolveModeId(request.modeId);

  return ensureFreshCompatOAuthCredentials(
    {
      ...request,
      modeId,
      tokenEndpoint: request.tokenEndpoint ?? config.endpoints.token[modeId],
      earlyRefreshWindowMs: request.earlyRefreshWindowMs ?? config.constants.earlyRefreshWindowMs,
    },
    options,
  );
}

export async function resolveCompatAuthHeaders(
  request: ResolveAuthHeadersRequest,
  options: ResolveAuthHeadersOptions = {},
  configOverrides: CompatRuntimeConfigOverrides = {},
) {
  const config = createCompatRuntimeConfig(configOverrides);
  const modeId = resolveModeId(request.refresh?.modeId);

  return resolveLaneAwareAuthHeaders(
    {
      ...request,
      refresh:
        request.refresh === undefined
          ? undefined
          : {
              ...request.refresh,
              modeId,
              tokenEndpoint: request.refresh.tokenEndpoint ?? config.endpoints.token[modeId],
              earlyRefreshWindowMs:
                request.refresh.earlyRefreshWindowMs ?? config.constants.earlyRefreshWindowMs,
            },
    },
    options,
  );
}
