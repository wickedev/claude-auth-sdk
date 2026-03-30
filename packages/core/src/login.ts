import { LoginError } from './errors.js';
import {
  COMPAT_AUTHORIZE_ENDPOINTS,
  DEFAULT_OAUTH_CLIENT_ID,
  DEFAULT_OAUTH_SCOPE,
} from './internal/browser/constants.js';
import { createPkceChallenge, createPkceVerifier, createState } from './internal/browser/pkce.js';
import { exchangeCompatOAuthCodeForCredentials } from './internal/server/callback/exchange.js';
import { createNodeDefaultStorageAdapter } from './internal/storage/node.js';
import { startCallbackServer } from './runtime/callback-server.js';
import { openBrowser } from './runtime/open-browser.js';
import type { LoginMode, LoginResult } from './types.js';

const CREATE_API_KEY_URL = 'https://api.anthropic.com/api/oauth/claude_cli/create_api_key';

async function createApiKeyFromAccessToken(
  accessToken: string,
  fetchImpl?: typeof fetch,
): Promise<string> {
  const doFetch = fetchImpl ?? fetch;
  const response = await doFetch(CREATE_API_KEY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new LoginError(`API key creation failed with HTTP ${response.status}`, 'exchange_failed');
  }

  const data = (await response.json()) as { raw_key?: string };
  if (!data.raw_key) {
    throw new LoginError('API key creation succeeded but no key returned', 'exchange_failed');
  }

  return data.raw_key;
}

export interface LoginInternalOptions {
  configDir?: string;
  openBrowserFn?: (url: string) => Promise<boolean>;
  fetchImpl?: typeof fetch;
}

export async function login(
  mode: LoginMode,
  internalOptions?: LoginInternalOptions,
): Promise<LoginResult> {
  const server = await startCallbackServer();

  try {
    const state = createState();
    const verifier = createPkceVerifier();
    const challenge = await createPkceChallenge(verifier);

    const redirectUri = `http://localhost:${server.port}/callback`;
    const scope = DEFAULT_OAUTH_SCOPE.join(' ');

    const params = new URLSearchParams({
      code: 'true',
      client_id: DEFAULT_OAUTH_CLIENT_ID,
      response_type: 'code',
      scope,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      redirect_uri: redirectUri,
    });

    const authorizeUrl = `${COMPAT_AUTHORIZE_ENDPOINTS[mode]}?${params.toString()}`;

    const openFn = internalOptions?.openBrowserFn ?? openBrowser;
    const opened = await openFn(authorizeUrl);

    if (!opened) {
      process.stdout.write(`\nOpen this URL in your browser to log in:\n${authorizeUrl}\n\n`);
    }

    const callbackParams = await server.waitForCallback();

    if (callbackParams.error) {
      throw new LoginError(callbackParams.errorDescription ?? callbackParams.error, 'cancelled');
    }

    if (!callbackParams.code || !callbackParams.state) {
      throw new LoginError('Missing authorization code in callback', 'cancelled');
    }

    if (callbackParams.state !== state) {
      throw new LoginError('OAuth state mismatch', 'cancelled');
    }

    const credentialResult = await exchangeCompatOAuthCodeForCredentials(
      {
        modeId: mode,
        code: callbackParams.code,
        state: callbackParams.state,
        codeVerifier: verifier,
        redirectUri,
        clientId: DEFAULT_OAUTH_CLIENT_ID,
        scope,
      },
      {
        fetchImpl: internalOptions?.fetchImpl,
      },
    );

    if (!credentialResult.ok) {
      throw new LoginError(credentialResult.message, 'exchange_failed');
    }

    const storage = createNodeDefaultStorageAdapter({
      configDir: internalOptions?.configDir,
    });

    if (mode === 'console') {
      // Console mode: use the OAuth access token to create an API key, then discard OAuth tokens
      if (credentialResult.terminal.mode !== 'compat-oauth') {
        throw new LoginError('Unexpected terminal state for console mode', 'exchange_failed');
      }

      const apiKey = await createApiKeyFromAccessToken(
        credentialResult.terminal.credentials.accessToken,
        internalOptions?.fetchImpl,
      );

      try {
        await storage.write({
          terminal: {
            mode: 'api-key',
            apiKey,
            source: 'derived-from-console-oauth',
          },
          updatedAt: Date.now(),
        });
      } catch (cause) {
        throw new LoginError('Failed to save credentials', 'storage_failed', cause);
      }
    } else {
      // claudeai mode: store OAuth tokens directly
      try {
        await storage.write({
          terminal: credentialResult.terminal,
          updatedAt: Date.now(),
        });
      } catch (cause) {
        throw new LoginError('Failed to save credentials', 'storage_failed', cause);
      }
    }

    return { mode, loggedIn: true };
  } catch (error) {
    if (error instanceof LoginError) {
      throw error;
    }
    throw new LoginError(
      error instanceof Error ? error.message : 'Login failed',
      'exchange_failed',
      error,
    );
  } finally {
    await server.close();
  }
}
