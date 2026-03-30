import type {
  AuthMode,
  AuthModePolicyGate,
  BrowserAuthInitiationRequest,
  BrowserAuthInitiationResponse,
  CredentialResult,
  CredentialTerminalState,
  OAuthAuthMode,
  ServerCallbackPayload,
} from './types.js';

export interface StoredCredentialEnvelope {
  terminal: CredentialTerminalState;
  updatedAt: number;
}

export interface StorageAdapter {
  read(): Promise<StoredCredentialEnvelope | null>;
  write(envelope: StoredCredentialEnvelope): Promise<void>;
  clear(): Promise<void>;
}

export interface BrowserAuthInitiator {
  initiate(request: BrowserAuthInitiationRequest): Promise<BrowserAuthInitiationResponse>;
}

export interface CallbackCodeExchangeRequest {
  mode: OAuthAuthMode;
  code: string;
  state: string;
  callbackPath: string;
}

export interface CallbackCodeExchanger {
  exchange(request: CallbackCodeExchangeRequest): Promise<CredentialResult>;
}

export interface CallbackPayloadValidator {
  validate(payload: ServerCallbackPayload, expectedState: string): CredentialResult;
}

export interface ModePolicy {
  evaluate(mode: AuthMode): AuthModePolicyGate;
}
