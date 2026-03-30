export const AUTH_SUPPORT_LANES = ['official', 'compat'] as const;

export type AuthSupportLane = (typeof AUTH_SUPPORT_LANES)[number];

export const AUTH_MODES = ['claudeai', 'console', 'bedrock', 'vertex', 'foundry'] as const;

export type AuthMode = (typeof AUTH_MODES)[number];
