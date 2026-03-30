import { PolicyGatedModeError } from '../core/errors.js';
import { AUTH_SUPPORT_MATRIX, CLAUDEAI_COMPAT_SCOPE_ASSUMPTION } from '../core/support-matrix.js';
import {
  COMPAT_AUTHORIZE_ENDPOINTS,
  DEFAULT_OAUTH_CLIENT_ID,
  DEFAULT_OAUTH_SCOPE,
  MANUAL_REDIRECT_URI,
  PROVIDER_CREDENTIAL_HINTS,
  PROVIDER_DOCS_URLS,
} from './constants.js';
import { createPkceChallenge, createPkceVerifier, createState } from './pkce.js';
import type {
  BrowserAuthStartRequest,
  BrowserAuthStartResult,
  BrowserCompatAuthRequest,
  BrowserProviderAuthRequest,
  CompatModeId,
  OfficialProviderModeId,
} from './types.js';

function isCompatModeId(mode: BrowserAuthStartRequest['mode']): mode is CompatModeId {
  return mode === 'claudeai' || mode === 'console';
}

function isCompatRequest(request: BrowserAuthStartRequest): request is BrowserCompatAuthRequest {
  return isCompatModeId(request.mode);
}

function toScope(scope: readonly string[] | undefined): string {
  if (scope === undefined || scope.length === 0) {
    return DEFAULT_OAUTH_SCOPE.join(' ');
  }

  return scope.join(' ');
}

function buildCompatRedirectUrl(params: {
  mode: CompatModeId;
  callbackUrl: string;
  state: string;
  challenge: string;
  clientId?: string;
  scope?: readonly string[];
  manualRedirectUri?: string;
  orgUuid?: string;
}): { automaticRedirectUrl: string; manualRedirectUrl: string } {
  const { mode, callbackUrl, state, challenge, clientId, scope, manualRedirectUri, orgUuid } =
    params;
  const authorizeBase = COMPAT_AUTHORIZE_ENDPOINTS[mode];

  const baseParams = new URLSearchParams({
    code: 'true',
    client_id: clientId ?? DEFAULT_OAUTH_CLIENT_ID,
    response_type: 'code',
    scope: toScope(scope),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });

  if (orgUuid !== undefined && orgUuid.length > 0) {
    baseParams.set('orgUUID', orgUuid);
  }

  const automaticParams = new URLSearchParams(baseParams);
  automaticParams.set('redirect_uri', callbackUrl);

  const manualParams = new URLSearchParams(baseParams);
  manualParams.set('redirect_uri', manualRedirectUri ?? MANUAL_REDIRECT_URI);

  return {
    automaticRedirectUrl: `${authorizeBase}?${automaticParams.toString()}`,
    manualRedirectUrl: `${authorizeBase}?${manualParams.toString()}`,
  };
}

function buildProviderInstructions(
  mode: OfficialProviderModeId,
  docsUrl?: string,
): BrowserAuthStartResult {
  return {
    lane: 'official',
    modeId: mode,
    terminalMode: 'official-provider',
    providerInstructions: {
      modeId: mode,
      docsUrl: docsUrl ?? PROVIDER_DOCS_URLS[mode],
      credentialAdapterHint: PROVIDER_CREDENTIAL_HINTS[mode],
    },
  };
}

async function buildCompatStartResult(
  request: BrowserCompatAuthRequest,
): Promise<BrowserAuthStartResult> {
  if (
    request.mode === 'claudeai' &&
    request.claudeAiCompatApproved === false &&
    AUTH_SUPPORT_MATRIX.claudeai.policyGate === CLAUDEAI_COMPAT_SCOPE_ASSUMPTION
  ) {
    throw new PolicyGatedModeError(
      'compat-oauth',
      'claudeai compatibility mode requires internal-approved-assumption to remain enabled.',
    );
  }

  const state = request.state ?? createState();
  const verifier = request.pkceVerifier ?? createPkceVerifier();
  const challenge = await createPkceChallenge(verifier);

  const { automaticRedirectUrl, manualRedirectUrl } = buildCompatRedirectUrl({
    mode: request.mode,
    callbackUrl: request.callbackUrl,
    state,
    challenge,
    clientId: request.clientId,
    scope: request.scope,
    manualRedirectUri: request.manualRedirectUri,
    orgUuid: request.orgUuid,
  });

  return {
    lane: 'compat',
    modeId: request.mode,
    terminalMode: 'compat-oauth',
    automaticRedirectUrl,
    manualRedirectUrl,
    state,
    pkce: {
      verifier,
      challenge,
      challengeMethod: 'S256',
    },
  };
}

export async function startBrowserAuth(
  request: BrowserAuthStartRequest,
): Promise<BrowserAuthStartResult> {
  if (isCompatRequest(request)) {
    return buildCompatStartResult(request);
  }

  const providerRequest: BrowserProviderAuthRequest = request;
  return buildProviderInstructions(providerRequest.mode, providerRequest.docsUrl);
}
