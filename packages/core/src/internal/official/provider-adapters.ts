import { adaptBedrockCredentials } from './bedrock.js';
import { adaptConsoleApiKeyCredentials } from './console-api-key.js';
import { adaptFoundryCredentials } from './foundry.js';
import type { OfficialProviderAdapterInput, OfficialProviderAdapterResult } from './types.js';
import { adaptVertexCredentials } from './vertex.js';

export function normalizeOfficialProviderCredentials(
  input: OfficialProviderAdapterInput,
): OfficialProviderAdapterResult {
  switch (input.kind) {
    case 'console-api-key':
      return adaptConsoleApiKeyCredentials(input.credentials);
    case 'bedrock':
      return adaptBedrockCredentials(input.credentials);
    case 'vertex':
      return adaptVertexCredentials(input.credentials);
    case 'foundry':
      return adaptFoundryCredentials(input.credentials);
    default: {
      const unhandledKind: never = input;
      throw new TypeError(`Unsupported official provider adapter kind: ${String(unhandledKind)}`);
    }
  }
}
