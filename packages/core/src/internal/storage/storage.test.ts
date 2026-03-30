import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { StoredCredentialEnvelope } from '../core/contracts.js';
import { BrowserStorageRequiredError, requireBrowserStorageAdapter } from './browser.js';
import { createNodeDefaultStorageAdapter, resolveNodeCredentialPaths } from './node.js';

const tempDirs: string[] = [];

async function createTempConfigDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'claude-auth-storage-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    }),
  );
});

describe('storage adapters', () => {
  it('persists compat oauth into .credentials.json with normalized refresh token fixture', async () => {
    const configDir = await createTempConfigDir();
    const adapter = createNodeDefaultStorageAdapter({ configDir, platform: 'linux' });
    const envelope: StoredCredentialEnvelope = {
      terminal: {
        mode: 'compat-oauth',
        providerKey: 'claudeai',
        credentials: {
          accessToken: 'at_123',
          refreshToken: '',
          expiresAt: 1730000000000,
          scopes: ['user:inference', 'user:profile'],
        },
      },
      updatedAt: Date.now(),
    };

    await adapter.write(envelope);
    const reloaded = await adapter.read();

    expect(reloaded).not.toBeNull();
    expect(reloaded?.terminal.mode).toBe('compat-oauth');
    if (reloaded?.terminal.mode === 'compat-oauth') {
      expect(reloaded.terminal.credentials.refreshToken).toBe('');
    }

    const paths = resolveNodeCredentialPaths(configDir);
    const credentialsRaw = await readFile(paths.credentialsFilePath, 'utf8');
    const parsed = JSON.parse(credentialsRaw) as {
      claudeAiOauth?: { refreshToken?: string };
    };
    expect(parsed.claudeAiOauth?.refreshToken).toBe('');
  });

  it('keeps oauth in .credentials.json and api-key in config.json semantics', async () => {
    const configDir = await createTempConfigDir();
    const adapter = createNodeDefaultStorageAdapter({ configDir, platform: 'linux' });
    const paths = resolveNodeCredentialPaths(configDir);

    await adapter.write({
      terminal: {
        mode: 'compat-oauth',
        providerKey: 'claudeai',
        credentials: {
          accessToken: 'at_compat',
          refreshToken: 'rt_compat',
          expiresAt: 1730000000000,
          scopes: ['user:inference'],
        },
      },
      updatedAt: Date.now(),
    });

    await adapter.write({
      terminal: {
        mode: 'api-key',
        apiKey: 'sk-ant-api-123',
        source: 'derived-from-console-oauth',
      },
      updatedAt: Date.now(),
    });

    const credentialsRaw = await readFile(paths.credentialsFilePath, 'utf8');
    const configRaw = await readFile(paths.configFilePath, 'utf8');

    const credentialsParsed = JSON.parse(credentialsRaw) as { claudeAiOauth?: unknown };
    const configParsed = JSON.parse(configRaw) as {
      primaryApiKey?: string;
      customApiKeyResponses?: { approved?: boolean };
    };

    expect(credentialsParsed.claudeAiOauth).toBeUndefined();
    expect(configParsed.primaryApiKey).toBe('sk-ant-api-123');
    expect(configParsed.customApiKeyResponses?.approved).toBe(true);

    const reloaded = await adapter.read();
    expect(reloaded?.terminal.mode).toBe('api-key');
  });

  it('normalizes malformed stored oauth refresh token to empty string on read', async () => {
    const configDir = await createTempConfigDir();
    const paths = resolveNodeCredentialPaths(configDir);

    await writeFile(
      paths.credentialsFilePath,
      JSON.stringify(
        {
          claudeAiOauth: {
            accessToken: 'at_seed',
            refreshToken: null,
            expiresAt: 1730000000000,
            scopes: ['user:inference'],
          },
        },
        null,
        2,
      ),
      'utf8',
    );

    const adapter = createNodeDefaultStorageAdapter({ configDir, platform: 'linux' });
    const reloaded = await adapter.read();

    expect(reloaded?.terminal.mode).toBe('compat-oauth');
    if (reloaded?.terminal.mode === 'compat-oauth') {
      expect(reloaded.terminal.credentials.refreshToken).toBe('');
    }
  });

  it('throws when browser storage is not explicitly injected', () => {
    expect(() => requireBrowserStorageAdapter(undefined)).toThrow(BrowserStorageRequiredError);
  });
});
