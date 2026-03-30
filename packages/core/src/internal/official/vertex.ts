import { OFFICIAL_ADAPTER_LANE, normalizeRequiredString } from './shared.js';
import type { VertexAdapterInput, VertexAdapterResult } from './types.js';

export function adaptVertexCredentials(input: VertexAdapterInput): VertexAdapterResult {
  return {
    lane: OFFICIAL_ADAPTER_LANE,
    kind: 'vertex',
    credentials: {
      projectId: normalizeRequiredString(input.projectId, 'projectId'),
      location: normalizeRequiredString(input.location, 'location'),
      serviceAccountJson: normalizeRequiredString(input.serviceAccountJson, 'serviceAccountJson'),
    },
  };
}
