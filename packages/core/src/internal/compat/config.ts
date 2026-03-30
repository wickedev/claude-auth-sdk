import {
  DEFAULT_OAUTH_CLIENT_ID,
  DEFAULT_OAUTH_SCOPE,
  MANUAL_REDIRECT_URI,
} from '../browser/constants.js';

export type CompatModeId = 'claudeai' | 'console';

export interface CompatRuntimeConfig {
  readonly endpoints: {
    readonly authorize: Readonly<Record<CompatModeId, string>>;
    readonly token: Readonly<Record<CompatModeId, string>>;
  };
  readonly constants: {
    readonly clientId: string;
    readonly scope: readonly string[];
    readonly manualRedirectUri: string;
    readonly earlyRefreshWindowMs: number;
  };
}

export interface CompatRuntimeConfigOverrides {
  readonly endpoints?: {
    readonly authorize?: Partial<Record<CompatModeId, string>>;
    readonly token?: Partial<Record<CompatModeId, string>>;
  };
  readonly constants?: {
    readonly clientId?: string;
    readonly scope?: readonly string[];
    readonly manualRedirectUri?: string;
    readonly earlyRefreshWindowMs?: number;
  };
}

const DEFAULT_COMPAT_CONFIG: CompatRuntimeConfig = {
  endpoints: {
    authorize: {
      claudeai: 'https://claude.com/cai/oauth/authorize',
      console: 'https://platform.claude.com/oauth/authorize',
    },
    token: {
      claudeai: 'https://platform.claude.com/v1/oauth/token',
      console: 'https://platform.claude.com/v1/oauth/token',
    },
  },
  constants: {
    clientId: DEFAULT_OAUTH_CLIENT_ID,
    scope: [...DEFAULT_OAUTH_SCOPE],
    manualRedirectUri: MANUAL_REDIRECT_URI,
    earlyRefreshWindowMs: 5 * 60 * 1000,
  },
};

export function getDefaultCompatRuntimeConfig(): CompatRuntimeConfig {
  return {
    endpoints: {
      authorize: { ...DEFAULT_COMPAT_CONFIG.endpoints.authorize },
      token: { ...DEFAULT_COMPAT_CONFIG.endpoints.token },
    },
    constants: {
      ...DEFAULT_COMPAT_CONFIG.constants,
      scope: [...DEFAULT_COMPAT_CONFIG.constants.scope],
    },
  };
}

export function createCompatRuntimeConfig(
  overrides: CompatRuntimeConfigOverrides = {},
): CompatRuntimeConfig {
  const defaults = getDefaultCompatRuntimeConfig();

  return {
    endpoints: {
      authorize: {
        ...defaults.endpoints.authorize,
        ...overrides.endpoints?.authorize,
      },
      token: {
        ...defaults.endpoints.token,
        ...overrides.endpoints?.token,
      },
    },
    constants: {
      clientId: overrides.constants?.clientId ?? defaults.constants.clientId,
      scope: [...(overrides.constants?.scope ?? defaults.constants.scope)],
      manualRedirectUri:
        overrides.constants?.manualRedirectUri ?? defaults.constants.manualRedirectUri,
      earlyRefreshWindowMs:
        overrides.constants?.earlyRefreshWindowMs ?? defaults.constants.earlyRefreshWindowMs,
    },
  };
}
