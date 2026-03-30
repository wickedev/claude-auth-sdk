import { describe, expect, it } from 'vitest';

import { adaptBedrockCredentials } from './bedrock.js';
import { adaptConsoleApiKeyCredentials } from './console-api-key.js';
import { adaptFoundryCredentials } from './foundry.js';
import { normalizeOfficialProviderCredentials } from './provider-adapters.js';
import { adaptVertexCredentials } from './vertex.js';

describe('official provider adapters', () => {
  it('normalizes console-api-key credentials without OAuth callback fields', () => {
    const result = adaptConsoleApiKeyCredentials({
      apiKey: '  sk-ant-api-example  ',
    });

    expect(result).toStrictEqual({
      lane: 'official',
      kind: 'console-api-key',
      credentials: {
        apiKey: 'sk-ant-api-example',
        source: 'user-supplied',
      },
    });

    expect(Object.hasOwn(result as object, 'automaticRedirectUrl')).toBe(false);
    expect(Object.hasOwn(result as object, 'manualRedirectUrl')).toBe(false);
  });

  it('normalizes bedrock credentials as official provider adapter data only', () => {
    const result = adaptBedrockCredentials({
      region: ' us-west-2 ',
      accessKeyId: ' AKIAEXAMPLE ',
      secretAccessKey: ' secret-value ',
      sessionToken: '  temporary-token  ',
    });

    expect(result).toStrictEqual({
      lane: 'official',
      kind: 'bedrock',
      credentials: {
        region: 'us-west-2',
        accessKeyId: 'AKIAEXAMPLE',
        secretAccessKey: 'secret-value',
        sessionToken: 'temporary-token',
      },
    });
  });

  it('normalizes vertex credentials as official provider adapter data only', () => {
    const result = adaptVertexCredentials({
      projectId: ' project-123 ',
      location: ' us-central1 ',
      serviceAccountJson: ' {"type":"service_account"} ',
    });

    expect(result).toStrictEqual({
      lane: 'official',
      kind: 'vertex',
      credentials: {
        projectId: 'project-123',
        location: 'us-central1',
        serviceAccountJson: '{"type":"service_account"}',
      },
    });
  });

  it('normalizes foundry credentials as official provider adapter data only', () => {
    const result = adaptFoundryCredentials({
      endpoint: ' https://example-resource.openai.azure.com ',
      apiKey: ' key-value ',
      deployment: ' claude-4 ',
      apiVersion: ' 2025-01-01-preview ',
    });

    expect(result).toStrictEqual({
      lane: 'official',
      kind: 'foundry',
      credentials: {
        endpoint: 'https://example-resource.openai.azure.com',
        apiKey: 'key-value',
        deployment: 'claude-4',
        apiVersion: '2025-01-01-preview',
      },
    });
  });

  it('supports high-level dispatch for all official provider adapter kinds', () => {
    const consoleResult = normalizeOfficialProviderCredentials({
      kind: 'console-api-key',
      credentials: { apiKey: ' sk-ant-api-dispatch ' },
    });

    const bedrockResult = normalizeOfficialProviderCredentials({
      kind: 'bedrock',
      credentials: {
        region: ' us-east-1 ',
        accessKeyId: ' AKIA-DISPATCH ',
        secretAccessKey: ' secret-dispatch ',
      },
    });

    const vertexResult = normalizeOfficialProviderCredentials({
      kind: 'vertex',
      credentials: {
        projectId: ' project-dispatch ',
        location: ' europe-west4 ',
        serviceAccountJson: ' {"type":"service_account"} ',
      },
    });

    const foundryResult = normalizeOfficialProviderCredentials({
      kind: 'foundry',
      credentials: {
        endpoint: ' https://dispatch-resource.openai.azure.com ',
        apiKey: ' foundry-dispatch ',
      },
    });

    expect(consoleResult.kind).toBe('console-api-key');
    expect(bedrockResult.kind).toBe('bedrock');
    expect(vertexResult.kind).toBe('vertex');
    expect(foundryResult.kind).toBe('foundry');
  });

  it('throws when required fields are blank', () => {
    expect(() =>
      normalizeOfficialProviderCredentials({
        kind: 'console-api-key',
        credentials: { apiKey: '    ' },
      }),
    ).toThrow('Expected non-empty string for "apiKey".');
  });
});
