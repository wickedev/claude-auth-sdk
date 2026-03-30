import type { CredentialResult } from '../../core/types.js';

export type CompatOAuthSupportModeId = 'claudeai' | 'console';

export interface CompatOAuthEndpointConfig {
  authorizeEndpoint: string;
  tokenEndpoint: string;
}

export interface CompatOAuthTokenExchangeRequest {
  modeId: CompatOAuthSupportModeId;
  code: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  scope?: string;
  endpointConfig?: Partial<CompatOAuthEndpointConfig>;
}

export interface HandleCompatOAuthCallbackRequest {
  modeId: CompatOAuthSupportModeId;
  expectedState: string;
  callbackUrl?: string;
  manualCodeInput?: string;
  callbackPath?: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  scope?: string;
  endpointConfig?: Partial<CompatOAuthEndpointConfig>;
}

export interface CompatOAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

export interface CompatOAuthTokenExchangeOptions {
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export type CompatOAuthTokenExchanger = (
  request: CompatOAuthTokenExchangeRequest,
  options?: CompatOAuthTokenExchangeOptions,
) => Promise<CredentialResult>;
