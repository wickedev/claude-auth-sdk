import type {
  ApiKeyTerminalState,
  CredentialTerminalState,
  OAuthCredentialBundle,
} from '../core/types.js';

export interface ClaudeAiOauthStorageRecord {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: readonly string[];
  subscriptionType?: string | null;
  rateLimitTier?: string | null;
}

export interface CredentialsFileShape {
  claudeAiOauth?: ClaudeAiOauthStorageRecord;
}

export interface ConfigFileShape {
  primaryApiKey?: string;
  customApiKeyResponses?: {
    approved?: boolean;
  };
}

export interface NodeCredentialPaths {
  configDir: string;
  credentialsFilePath: string;
  configFilePath: string;
}

export interface SecureStorageAdapter {
  readOAuth?(): Promise<ClaudeAiOauthStorageRecord | null>;
  writeOAuth?(value: ClaudeAiOauthStorageRecord): Promise<void>;
  clearOAuth?(): Promise<void>;
  readApiKey?(): Promise<string | null>;
  writeApiKey?(value: string): Promise<void>;
  clearApiKey?(): Promise<void>;
}

export interface NodeStorageAdapterOptions {
  configDir?: string;
  platform?: NodeJS.Platform;
  secureStorage?: SecureStorageAdapter;
}

export interface NormalizedApiKeyEnvelope {
  mode: Extract<CredentialTerminalState['mode'], 'api-key'>;
  state: ApiKeyTerminalState;
}

export interface NormalizedOauthEnvelope {
  mode: Extract<CredentialTerminalState['mode'], 'official-provider' | 'compat-oauth'>;
  credentials: OAuthCredentialBundle;
  metadata: {
    subscriptionType?: string;
    rateLimitTier?: string;
  };
}
