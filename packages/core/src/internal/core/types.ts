export type AuthMode = 'official-provider' | 'compat-oauth' | 'api-key';

export type OAuthAuthMode = Extract<AuthMode, 'official-provider' | 'compat-oauth'>;

export type AuthInitiationChannel = 'automatic-browser' | 'manual-copy' | 'automatic-or-manual';

export interface BrowserAuthInitiationRequest {
  mode: OAuthAuthMode;
  callbackPath: string;
  channel: AuthInitiationChannel;
  prompt?: string;
}

export interface BrowserAuthInitiationResponse {
  mode: OAuthAuthMode;
  authorizationUrl: string;
  manualCodeUrl?: string;
  state: string;
}

export interface ServerCallbackPayload {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}

export interface OAuthCredentialBundle {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: readonly string[];
}

export type SubscriptionType = 'max' | 'pro' | 'team' | 'enterprise' | 'unknown';

export interface OfficialProviderTerminalState {
  mode: 'official-provider';
  credentials: OAuthCredentialBundle;
  subscriptionType?: SubscriptionType;
  rateLimitTier?: string;
}

export interface CompatOAuthTerminalState {
  mode: 'compat-oauth';
  credentials: OAuthCredentialBundle;
  providerKey: string;
  providerLabel?: string;
}

export interface ApiKeyTerminalState {
  mode: 'api-key';
  apiKey: string;
  source: 'user-supplied' | 'derived-from-console-oauth';
}

export type CredentialTerminalState =
  | OfficialProviderTerminalState
  | CompatOAuthTerminalState
  | ApiKeyTerminalState;

export type CredentialResult =
  | {
      ok: true;
      terminal: CredentialTerminalState;
    }
  | {
      ok: false;
      reason:
        | 'invalid-state'
        | 'missing-code'
        | 'policy-gated-mode'
        | 'unsupported-runtime'
        | 'refresh-failure'
        | 'storage-failure';
      message: string;
    };

export interface AuthModePolicyGate {
  mode: AuthMode;
  allowed: boolean;
  reason?: string;
}
