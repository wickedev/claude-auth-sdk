import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StoredCredentialEnvelope } from '../../core/contracts.js';
import { createNodeDefaultStorageAdapter } from '../../storage/node.js';
import { resolveLaneAwareAuthHeaders } from './headers.js';
import { ensureFreshCompatOAuthCredentials } from './refresh.js';

const tempDirs: string[] = [];

async function createTempConfigDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'claude-auth-refresh-'));
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

describe('server refresh and header handling', () => {
  it('persists rotated refresh token when refresh response returns rt_new', async () => {
    const now = 1_730_000_000_000;
    const configDir = await createTempConfigDir();
    const storage = createNodeDefaultStorageAdapter({ configDir, platform: 'linux' });

    const envelope: StoredCredentialEnvelope = {
      terminal: {
        mode: 'compat-oauth',
        providerKey: 'claudeai',
        credentials: {
          accessToken: 'at_old',
          refreshToken: 'rt_old',
          expiresAt: now - 60_000,
          scopes: ['user:inference'],
        },
      },
      updatedAt: now - 60_000,
    };

    await storage.write(envelope);

    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'at_new',
          refresh_token: 'rt_new',
          expires_in: 3600,
          scope: 'user:inference user:profile',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const refreshed = await ensureFreshCompatOAuthCredentials(
      {
        storage,
        clientId: 'desktop',
      },
      {
        fetchImpl,
        now: () => now,
        envelope,
      },
    );

    expect(refreshed.ok).toBe(true);
    if (refreshed.ok) {
      expect(refreshed.status).toBe('refreshed');
      expect(refreshed.rotatedRefreshToken).toBe(true);
      expect(refreshed.envelope.terminal.mode).toBe('compat-oauth');
      if (refreshed.envelope.terminal.mode === 'compat-oauth') {
        expect(refreshed.envelope.terminal.credentials.refreshToken).toBe('rt_new');
      }
    }

    const reloaded = await storage.read();
    expect(reloaded?.terminal.mode).toBe('compat-oauth');
    if (reloaded?.terminal.mode === 'compat-oauth') {
      expect(reloaded.terminal.credentials.accessToken).toBe('at_new');
      expect(reloaded.terminal.credentials.refreshToken).toBe('rt_new');
      expect(reloaded.terminal.credentials.scopes).toStrictEqual([
        'user:inference',
        'user:profile',
      ]);
    }

    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('returns typed missing-refresh-token result and skips network when refresh token is empty', async () => {
    const now = 1_730_000_000_000;
    const configDir = await createTempConfigDir();
    const storage = createNodeDefaultStorageAdapter({ configDir, platform: 'linux' });

    const envelope: StoredCredentialEnvelope = {
      terminal: {
        mode: 'compat-oauth',
        providerKey: 'claudeai',
        credentials: {
          accessToken: 'at_old',
          refreshToken: '',
          expiresAt: now - 60_000,
          scopes: ['user:inference'],
        },
      },
      updatedAt: now - 60_000,
    };

    await storage.write(envelope);

    const fetchImpl = vi.fn();

    const refreshed = await ensureFreshCompatOAuthCredentials(
      {
        storage,
        clientId: 'desktop',
      },
      {
        fetchImpl,
        now: () => now,
        envelope,
      },
    );

    expect(refreshed.ok).toBe(false);
    if (!refreshed.ok) {
      expect(refreshed.reason).toBe('missing-refresh-token');
      expect(refreshed.refreshAttempted).toBe(false);
    }

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('prefers valid oauth bearer and falls back to api-key headers by terminal mode', async () => {
    const now = 1_730_000_000_000;

    const oauthStorage = createNodeDefaultStorageAdapter({
      configDir: await createTempConfigDir(),
      platform: 'linux',
    });
    await oauthStorage.write({
      terminal: {
        mode: 'compat-oauth',
        providerKey: 'claudeai',
        credentials: {
          accessToken: 'at_valid',
          refreshToken: 'rt_valid',
          expiresAt: now + 10 * 60_000,
          scopes: ['user:inference'],
        },
      },
      updatedAt: now,
    });

    const oauthHeaders = await resolveLaneAwareAuthHeaders(
      { storage: oauthStorage },
      { now: () => now },
    );
    expect(oauthHeaders.ok).toBe(true);
    if (oauthHeaders.ok) {
      expect(oauthHeaders.source).toBe('oauth-bearer');
      expect(oauthHeaders.headers.Authorization).toBe('Bearer at_valid');
    }

    const apiKeyStorage = createNodeDefaultStorageAdapter({
      configDir: await createTempConfigDir(),
      platform: 'linux',
    });
    await apiKeyStorage.write({
      terminal: {
        mode: 'api-key',
        apiKey: 'sk-ant-api-123',
        source: 'user-supplied',
      },
      updatedAt: now,
    });

    const apiKeyHeaders = await resolveLaneAwareAuthHeaders({ storage: apiKeyStorage });
    expect(apiKeyHeaders.ok).toBe(true);
    if (apiKeyHeaders.ok) {
      expect(apiKeyHeaders.source).toBe('api-key');
      expect(apiKeyHeaders.headers['x-api-key']).toBe('sk-ant-api-123');
    }
  });
});
