import {
  OFFICIAL_ADAPTER_LANE,
  normalizeOptionalString,
  normalizeRequiredString,
} from './shared.js';
import type { BedrockAdapterInput, BedrockAdapterResult } from './types.js';

export function adaptBedrockCredentials(input: BedrockAdapterInput): BedrockAdapterResult {
  return {
    lane: OFFICIAL_ADAPTER_LANE,
    kind: 'bedrock',
    credentials: {
      region: normalizeRequiredString(input.region, 'region'),
      accessKeyId: normalizeRequiredString(input.accessKeyId, 'accessKeyId'),
      secretAccessKey: normalizeRequiredString(input.secretAccessKey, 'secretAccessKey'),
      sessionToken: normalizeOptionalString(input.sessionToken),
    },
  };
}
