import type { StoredCredentialEnvelope } from '../core/contracts.js';
import type {
  ApiKeyTerminalState,
  CompatOAuthTerminalState,
  CredentialTerminalState,
  OfficialProviderTerminalState,
} from '../core/types.js';
import type {
  ClaudeAiOauthStorageRecord,
  ConfigFileShape,
  CredentialsFileShape,
  NormalizedApiKeyEnvelope,
  NormalizedOauthEnvelope,
} from './types.js';

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function normalizeExpiresAt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export function normalizeOAuthRecord(
  record: Partial<ClaudeAiOauthStorageRecord>,
): ClaudeAiOauthStorageRecord {
  return {
    accessToken: typeof record.accessToken === 'string' ? record.accessToken : '',
    refreshToken: typeof record.refreshToken === 'string' ? record.refreshToken : '',
    expiresAt: normalizeExpiresAt(record.expiresAt),
    scopes: normalizeStringArray(record.scopes),
    subscriptionType: typeof record.subscriptionType === 'string' ? record.subscriptionType : null,
    rateLimitTier: typeof record.rateLimitTier === 'string' ? record.rateLimitTier : null,
  };
}

export function normalizeStoredOauthEnvelope(
  record: Partial<ClaudeAiOauthStorageRecord>,
): NormalizedOauthEnvelope {
  const normalized = normalizeOAuthRecord(record);

  return {
    mode: 'compat-oauth',
    credentials: {
      accessToken: normalized.accessToken,
      refreshToken: normalized.refreshToken,
      expiresAt: normalized.expiresAt,
      scopes: normalized.scopes,
    },
    metadata: {
      subscriptionType:
        normalized.subscriptionType === null ? undefined : normalized.subscriptionType,
      rateLimitTier: normalized.rateLimitTier === null ? undefined : normalized.rateLimitTier,
    },
  };
}

export function serializeOAuthTerminalState(
  terminal: OfficialProviderTerminalState | CompatOAuthTerminalState,
): ClaudeAiOauthStorageRecord {
  return {
    accessToken: terminal.credentials.accessToken,
    refreshToken: terminal.credentials.refreshToken,
    expiresAt: terminal.credentials.expiresAt,
    scopes: [...terminal.credentials.scopes],
    subscriptionType:
      terminal.mode === 'official-provider' ? (terminal.subscriptionType ?? null) : null,
    rateLimitTier: terminal.mode === 'official-provider' ? (terminal.rateLimitTier ?? null) : null,
  };
}

export function normalizeApiKeyTerminalState(
  config: ConfigFileShape,
): NormalizedApiKeyEnvelope | null {
  if (typeof config.primaryApiKey !== 'string' || config.primaryApiKey.length === 0) {
    return null;
  }

  const state: ApiKeyTerminalState = {
    mode: 'api-key',
    apiKey: config.primaryApiKey,
    source: config.customApiKeyResponses?.approved ? 'derived-from-console-oauth' : 'user-supplied',
  };

  return {
    mode: 'api-key',
    state,
  };
}

export function toStoredEnvelopeFromNativeShapes(params: {
  credentialsFile: CredentialsFileShape;
  configFile: ConfigFileShape;
  updatedAt: number;
}): StoredCredentialEnvelope | null {
  const oauthRecord = params.credentialsFile.claudeAiOauth;
  if (oauthRecord !== undefined) {
    const normalized = normalizeStoredOauthEnvelope(oauthRecord);
    const terminal: CredentialTerminalState = {
      mode: normalized.mode,
      credentials: normalized.credentials,
      providerKey: 'claudeai',
      providerLabel: 'Claude.ai compatibility lane',
    };

    return {
      terminal,
      updatedAt: params.updatedAt,
    };
  }

  const normalizedApiKey = normalizeApiKeyTerminalState(params.configFile);
  if (normalizedApiKey === null) {
    return null;
  }

  return {
    terminal: normalizedApiKey.state,
    updatedAt: params.updatedAt,
  };
}

export function updateConfigWithApiKey(params: {
  configFile: ConfigFileShape;
  terminal: ApiKeyTerminalState;
}): ConfigFileShape {
  const nextApproved = params.terminal.source === 'derived-from-console-oauth';

  return {
    ...params.configFile,
    primaryApiKey: params.terminal.apiKey,
    customApiKeyResponses: {
      ...params.configFile.customApiKeyResponses,
      approved: nextApproved,
    },
  };
}
