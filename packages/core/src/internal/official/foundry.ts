import {
  OFFICIAL_ADAPTER_LANE,
  normalizeOptionalString,
  normalizeRequiredString,
} from './shared.js';
import type { FoundryAdapterInput, FoundryAdapterResult } from './types.js';

export function adaptFoundryCredentials(input: FoundryAdapterInput): FoundryAdapterResult {
  return {
    lane: OFFICIAL_ADAPTER_LANE,
    kind: 'foundry',
    credentials: {
      endpoint: normalizeRequiredString(input.endpoint, 'endpoint'),
      apiKey: normalizeRequiredString(input.apiKey, 'apiKey'),
      deployment: normalizeOptionalString(input.deployment),
      apiVersion: normalizeOptionalString(input.apiVersion),
    },
  };
}
