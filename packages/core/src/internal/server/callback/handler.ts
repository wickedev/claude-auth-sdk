import { MissingAuthorizationCodeError } from '../../core/errors.js';
import type { CredentialResult } from '../../core/types.js';
import { exchangeCompatOAuthCodeForCredentials } from './exchange.js';
import {
  parseAuthorizationCodeFromLocalhostCallback,
  parseAuthorizationCodeFromManualInput,
} from './parse.js';
import type {
  CompatOAuthTokenExchangeOptions,
  CompatOAuthTokenExchanger,
  HandleCompatOAuthCallbackRequest,
} from './types.js';

export interface HandleCompatOAuthCallbackOptions extends CompatOAuthTokenExchangeOptions {
  tokenExchanger?: CompatOAuthTokenExchanger;
}

export async function handleCompatOAuthCallback(
  request: HandleCompatOAuthCallbackRequest,
  options: HandleCompatOAuthCallbackOptions = {},
): Promise<CredentialResult> {
  const parsedCode = resolveAuthorizationCode(request);
  const tokenExchanger = options.tokenExchanger ?? exchangeCompatOAuthCodeForCredentials;

  return tokenExchanger(
    {
      modeId: request.modeId,
      code: parsedCode.code,
      state: parsedCode.state,
      codeVerifier: request.codeVerifier,
      redirectUri: request.redirectUri,
      clientId: request.clientId,
      scope: request.scope,
      endpointConfig: request.endpointConfig,
    },
    {
      fetchImpl: options.fetchImpl,
      now: options.now,
    },
  );
}

function resolveAuthorizationCode(request: HandleCompatOAuthCallbackRequest): {
  code: string;
  state: string;
} {
  if (request.manualCodeInput !== undefined) {
    return parseAuthorizationCodeFromManualInput({
      manualCodeInput: request.manualCodeInput,
      expectedState: request.expectedState,
    });
  }

  if (request.callbackUrl !== undefined) {
    return parseAuthorizationCodeFromLocalhostCallback({
      callbackUrl: request.callbackUrl,
      expectedState: request.expectedState,
      callbackPath: request.callbackPath,
    });
  }

  throw new MissingAuthorizationCodeError(
    'Either callbackUrl or manualCodeInput is required to extract authorization code.',
  );
}
