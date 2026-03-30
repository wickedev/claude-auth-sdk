import type { AuthSupportLane, AuthMode as SupportMatrixModeId } from '../core/auth-support.js';
import type { ServerCallbackPayload, AuthMode as TerminalAuthMode } from '../core/types.js';

export type CompatModeId = Extract<SupportMatrixModeId, 'claudeai' | 'console'>;
export type OfficialProviderModeId = Extract<SupportMatrixModeId, 'bedrock' | 'vertex' | 'foundry'>;

export interface BrowserPkceMaterial {
  readonly verifier: string;
  readonly challenge: string;
  readonly challengeMethod: 'S256';
}

export interface BrowserCompatAuthRequest {
  readonly mode: CompatModeId;
  readonly callbackUrl: string;
  readonly state?: string;
  readonly pkceVerifier?: string;
  readonly clientId?: string;
  readonly scope?: readonly string[];
  readonly orgUuid?: string;
  readonly manualRedirectUri?: string;
  readonly claudeAiCompatApproved?: boolean;
}

export interface BrowserProviderAuthRequest {
  readonly mode: OfficialProviderModeId;
  readonly docsUrl?: string;
}

export type BrowserAuthStartRequest = BrowserCompatAuthRequest | BrowserProviderAuthRequest;

export interface CompatBrowserAuthStartResult {
  readonly lane: Extract<AuthSupportLane, 'compat'>;
  readonly modeId: CompatModeId;
  readonly terminalMode: Extract<TerminalAuthMode, 'compat-oauth'>;
  readonly automaticRedirectUrl: string;
  readonly manualRedirectUrl: string;
  readonly state: string;
  readonly pkce: BrowserPkceMaterial;
}

export interface ProviderInstruction {
  readonly modeId: OfficialProviderModeId;
  readonly docsUrl: string;
  readonly credentialAdapterHint: string;
}

export interface ProviderBrowserAuthStartResult {
  readonly lane: Extract<AuthSupportLane, 'official'>;
  readonly modeId: OfficialProviderModeId;
  readonly terminalMode: Extract<TerminalAuthMode, 'official-provider'>;
  readonly providerInstructions: ProviderInstruction;
}

export type BrowserAuthStartResult = CompatBrowserAuthStartResult | ProviderBrowserAuthStartResult;

export interface ParseBrowserRedirectInput {
  readonly source: 'redirect-url';
  readonly callback: string | URL;
  readonly expectedState?: string;
}

export interface ParseBrowserManualInput {
  readonly source: 'manual-code';
  readonly callback: string;
  readonly expectedState?: string;
}

export type ParseBrowserCallbackInput = ParseBrowserRedirectInput | ParseBrowserManualInput;

export interface ParsedBrowserCallbackPayload {
  readonly source: ParseBrowserCallbackInput['source'];
  readonly mode: Extract<TerminalAuthMode, 'compat-oauth'>;
  readonly payload: ServerCallbackPayload;
  readonly code: string;
  readonly state?: string;
}
