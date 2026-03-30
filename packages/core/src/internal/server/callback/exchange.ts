import type { CredentialResult } from '../../core/types.js';
import type {
  CompatOAuthEndpointConfig,
  CompatOAuthSupportModeId,
  CompatOAuthTokenExchangeOptions,
  CompatOAuthTokenExchangeRequest,
  CompatOAuthTokenResponse,
} from './types.js';

const DEFAULT_COMPAT_OAUTH_ENDPOINTS: Readonly<
  Record<CompatOAuthSupportModeId, CompatOAuthEndpointConfig>
> = {
  claudeai: {
    authorizeEndpoint: 'https://claude.com/cai/oauth/authorize',
    tokenEndpoint: 'https://platform.claude.com/v1/oauth/token',
  },
  console: {
    authorizeEndpoint: 'https://platform.claude.com/oauth/authorize',
    tokenEndpoint: 'https://platform.claude.com/v1/oauth/token',
  },
};

const COMPAT_PROVIDER_LABELS: Readonly<Record<CompatOAuthSupportModeId, string>> = {
  claudeai: 'Claude.ai',
  console: 'Anthropic Console',
};

export function resolveCompatOAuthEndpointConfig(
  modeId: CompatOAuthSupportModeId,
  override?: Partial<CompatOAuthEndpointConfig>,
): CompatOAuthEndpointConfig {
  const defaults = DEFAULT_COMPAT_OAUTH_ENDPOINTS[modeId];

  return {
    authorizeEndpoint: override?.authorizeEndpoint ?? defaults.authorizeEndpoint,
    tokenEndpoint: override?.tokenEndpoint ?? defaults.tokenEndpoint,
  };
}

export async function exchangeCompatOAuthCodeForCredentials(
  request: CompatOAuthTokenExchangeRequest,
  options: CompatOAuthTokenExchangeOptions = {},
): Promise<CredentialResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const endpointConfig = resolveCompatOAuthEndpointConfig(request.modeId, request.endpointConfig);

  const response = await fetchImpl(endpointConfig.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: request.code,
      redirect_uri: request.redirectUri,
      client_id: request.clientId,
      code_verifier: request.codeVerifier,
      state: request.state,
      scope: request.scope,
    }),
  });

  const responseData = await tryReadTokenResponse(response);

  if (!response.ok) {
    const rawMessage =
      responseData.error_description ??
      responseData.error ??
      `Token exchange failed with HTTP ${response.status}.`;
    const message = typeof rawMessage === 'string' ? rawMessage : JSON.stringify(rawMessage);
    throw new Error(message);
  }

  const accessToken = responseData.access_token;
  if (!accessToken) {
    throw new Error('Token exchange succeeded without access_token.');
  }

  const expiresIn = coerceExpiresInSeconds(responseData.expires_in);
  const scope = responseData.scope ?? request.scope ?? '';
  const scopes = scope.trim() === '' ? [] : scope.trim().split(/\s+/);

  return {
    ok: true,
    terminal: {
      mode: 'compat-oauth',
      providerKey: request.modeId,
      providerLabel: COMPAT_PROVIDER_LABELS[request.modeId],
      credentials: {
        accessToken,
        refreshToken: responseData.refresh_token ?? '',
        expiresAt: now() + expiresIn * 1000,
        scopes,
      },
    },
  };
}

async function tryReadTokenResponse(response: Response): Promise<CompatOAuthTokenResponse> {
  try {
    const payload = (await response.json()) as CompatOAuthTokenResponse;
    return payload;
  } catch {
    return {};
  }
}

function coerceExpiresInSeconds(value: number | string | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return 0;
}
