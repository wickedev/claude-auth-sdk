import { describe, expect, it, vi } from 'vitest';

import { InvalidStateError } from '../../core/errors.js';
import { handleCompatOAuthCallback } from './handler.js';

describe('handleCompatOAuthCallback', () => {
  it('extracts code/state from localhost callback fixture and exchanges token', async () => {
    const tokenExchanger = vi.fn().mockResolvedValue({
      ok: true,
      terminal: {
        mode: 'compat-oauth',
        providerKey: 'claudeai',
        providerLabel: 'Claude.ai',
        credentials: {
          accessToken: 'at_123',
          refreshToken: 'rt_123',
          expiresAt: 123,
          scopes: ['user:inference'],
        },
      },
    });

    const result = await handleCompatOAuthCallback(
      {
        modeId: 'claudeai',
        expectedState: 'abc123',
        callbackUrl: 'http://127.0.0.1:3456/callback?code=code_123&state=abc123',
        callbackPath: '/callback',
        codeVerifier: 'pkce_verifier',
        redirectUri: 'http://localhost:3456/callback',
        clientId: 'client_123',
      },
      { tokenExchanger },
    );

    expect(result.ok).toBe(true);
    expect(tokenExchanger).toHaveBeenCalledOnce();
    expect(tokenExchanger).toHaveBeenCalledWith(
      expect.objectContaining({
        modeId: 'claudeai',
        code: 'code_123',
        state: 'abc123',
      }),
      expect.objectContaining({ fetchImpl: undefined, now: undefined }),
    );
  });

  it('fails closed on wrong state and does not perform token exchange', async () => {
    const tokenExchanger = vi.fn();

    await expect(
      handleCompatOAuthCallback(
        {
          modeId: 'claudeai',
          expectedState: 'abc123',
          callbackUrl: '/callback?code=code_123&state=wrong_state',
          callbackPath: '/callback',
          codeVerifier: 'pkce_verifier',
          redirectUri: 'http://localhost:3456/callback',
          clientId: 'client_123',
        },
        { tokenExchanger },
      ),
    ).rejects.toBeInstanceOf(InvalidStateError);

    expect(tokenExchanger).not.toHaveBeenCalled();
  });

  it('accepts manual fallback input in code#state form', async () => {
    const tokenExchanger = vi.fn().mockResolvedValue({
      ok: true,
      terminal: {
        mode: 'compat-oauth',
        providerKey: 'console',
        providerLabel: 'Anthropic Console',
        credentials: {
          accessToken: 'at_console',
          refreshToken: 'rt_console',
          expiresAt: 123,
          scopes: ['org:create_api_key'],
        },
      },
    });

    await handleCompatOAuthCallback(
      {
        modeId: 'console',
        expectedState: 'abc123',
        manualCodeInput: 'code_123#abc123',
        codeVerifier: 'pkce_verifier',
        redirectUri: 'urn:ietf:wg:oauth:2.0:oob',
        clientId: 'client_123',
      },
      { tokenExchanger },
    );

    expect(tokenExchanger).toHaveBeenCalledWith(
      expect.objectContaining({
        modeId: 'console',
        code: 'code_123',
        state: 'abc123',
      }),
      expect.any(Object),
    );
  });

  it('rejects manual fallback input when state mismatches', async () => {
    const tokenExchanger = vi.fn();

    await expect(
      handleCompatOAuthCallback(
        {
          modeId: 'console',
          expectedState: 'abc123',
          manualCodeInput: 'code_123#wrong_state',
          codeVerifier: 'pkce_verifier',
          redirectUri: 'urn:ietf:wg:oauth:2.0:oob',
          clientId: 'client_123',
        },
        { tokenExchanger },
      ),
    ).rejects.toBeInstanceOf(InvalidStateError);

    expect(tokenExchanger).not.toHaveBeenCalled();
  });
});
