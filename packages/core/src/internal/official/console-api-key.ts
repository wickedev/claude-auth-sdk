import { OFFICIAL_ADAPTER_LANE, normalizeRequiredString } from './shared.js';
import type { ConsoleApiKeyAdapterInput, ConsoleApiKeyAdapterResult } from './types.js';

export function adaptConsoleApiKeyCredentials(
  input: ConsoleApiKeyAdapterInput,
): ConsoleApiKeyAdapterResult {
  return {
    lane: OFFICIAL_ADAPTER_LANE,
    kind: 'console-api-key',
    credentials: {
      apiKey: normalizeRequiredString(input.apiKey, 'apiKey'),
      source: 'user-supplied',
    },
  };
}
