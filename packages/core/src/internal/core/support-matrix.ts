import type { AuthMode, AuthSupportLane } from './auth-support';

export type SupportPolicyGate = 'generally-available' | 'internal-approved-assumption';

export interface AuthModeSupportEntry {
  readonly mode: AuthMode;
  readonly lane: AuthSupportLane;
  readonly officialAnthropicSurface: boolean;
  readonly policyGate: SupportPolicyGate;
  readonly description: string;
}

export const CLAUDEAI_COMPAT_SCOPE_ASSUMPTION = 'internal-approved-assumption';

export const AUTH_SUPPORT_MATRIX: Readonly<Record<AuthMode, AuthModeSupportEntry>> = {
  claudeai: {
    mode: 'claudeai',
    lane: 'compat',
    officialAnthropicSurface: false,
    policyGate: CLAUDEAI_COMPAT_SCOPE_ASSUMPTION,
    description:
      'Claude.ai account compatibility path; in scope only under internal/approved assumption and never official.',
  },
  console: {
    mode: 'console',
    lane: 'compat',
    officialAnthropicSurface: false,
    policyGate: 'generally-available',
    description:
      'Native Anthropic Console OAuth compatibility path; intentionally labeled compat rather than official.',
  },
  bedrock: {
    mode: 'bedrock',
    lane: 'official',
    officialAnthropicSurface: true,
    policyGate: 'generally-available',
    description: 'AWS Bedrock official credential adapter lane for third-party provider access.',
  },
  vertex: {
    mode: 'vertex',
    lane: 'official',
    officialAnthropicSurface: true,
    policyGate: 'generally-available',
    description: 'Google Vertex official credential adapter lane for third-party provider access.',
  },
  foundry: {
    mode: 'foundry',
    lane: 'official',
    officialAnthropicSurface: true,
    policyGate: 'generally-available',
    description:
      'Azure AI Foundry official credential adapter lane for third-party provider access.',
  },
} as const;

export const OFFICIAL_AUTH_MODES: readonly AuthMode[] = ['bedrock', 'vertex', 'foundry'];

export const COMPAT_AUTH_MODES: readonly AuthMode[] = ['claudeai', 'console'];
