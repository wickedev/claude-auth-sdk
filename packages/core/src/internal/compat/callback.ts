import { exchangeCompatOAuthCodeForCredentials } from '../server/callback/exchange.js';
import {
  type HandleCompatOAuthCallbackOptions,
  handleCompatOAuthCallback,
} from '../server/callback/handler.js';
import type {
  CompatOAuthTokenExchangeOptions,
  CompatOAuthTokenExchangeRequest,
  HandleCompatOAuthCallbackRequest,
} from '../server/callback/types.js';
import {
  type CompatModeId,
  type CompatRuntimeConfigOverrides,
  createCompatRuntimeConfig,
} from './config.js';

function resolveModeId(modeId: CompatModeId | undefined): CompatModeId {
  return modeId ?? 'claudeai';
}

export async function exchangeCompatCodeForCredentials(
  request: CompatOAuthTokenExchangeRequest,
  options: CompatOAuthTokenExchangeOptions = {},
  configOverrides: CompatRuntimeConfigOverrides = {},
) {
  const config = createCompatRuntimeConfig(configOverrides);
  const modeId = resolveModeId(request.modeId);

  return exchangeCompatOAuthCodeForCredentials(
    {
      ...request,
      endpointConfig: {
        authorizeEndpoint:
          request.endpointConfig?.authorizeEndpoint ?? config.endpoints.authorize[modeId],
        tokenEndpoint: request.endpointConfig?.tokenEndpoint ?? config.endpoints.token[modeId],
      },
    },
    options,
  );
}

export async function handleCompatCallback(
  request: HandleCompatOAuthCallbackRequest,
  options: HandleCompatOAuthCallbackOptions = {},
  configOverrides: CompatRuntimeConfigOverrides = {},
) {
  const config = createCompatRuntimeConfig(configOverrides);
  const modeId = resolveModeId(request.modeId);

  return handleCompatOAuthCallback(
    {
      ...request,
      endpointConfig: {
        authorizeEndpoint:
          request.endpointConfig?.authorizeEndpoint ?? config.endpoints.authorize[modeId],
        tokenEndpoint: request.endpointConfig?.tokenEndpoint ?? config.endpoints.token[modeId],
      },
    },
    options,
  );
}
