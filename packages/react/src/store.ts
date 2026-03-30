import type {
  LoginInternalOptions,
  LoginMode,
  LoginResult,
  OAuthCredentialBundle,
  StoredCredentialEnvelope,
} from '@claude-auth-sdk/core';
import {
  LoginError,
  createNodeDefaultStorageAdapter,
  login as defaultLogin,
  openBrowser,
} from '@claude-auth-sdk/core';

export type LoggedInCredentials =
  | { type: 'oauth'; credentials: OAuthCredentialBundle }
  | { type: 'api-key'; apiKey: string };

export type LoginState =
  | { status: 'checking' }
  | { status: 'idle' }
  | { status: 'logging_in'; authUrl: string }
  | { status: 'logged_in'; credentials: LoggedInCredentials }
  | { status: 'error'; error: LoginError };

export interface LoginStore {
  getState(): LoginState;
  startLogin(mode?: LoginMode): Promise<void>;
  logout(): Promise<void>;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

type LoginFn = (mode: LoginMode, options?: LoginInternalOptions) => Promise<LoginResult>;
type ReadFn = () => Promise<StoredCredentialEnvelope | null>;
type ClearFn = () => Promise<void>;

type OpenBrowserFn = (url: string) => Promise<boolean>;

export interface LoginStoreDeps {
  loginFn?: LoginFn;
  readFn?: ReadFn;
  clearFn?: ClearFn;
  openBrowserFn?: OpenBrowserFn;
}

const defaultAdapter = createNodeDefaultStorageAdapter();

function defaultReadFn(): Promise<StoredCredentialEnvelope | null> {
  return defaultAdapter.read();
}

function defaultClearFn(): Promise<void> {
  return defaultAdapter.clear();
}

export function createLoginStore(deps: LoginStoreDeps = {}): LoginStore {
  const loginFn = deps.loginFn ?? defaultLogin;
  const readFn = deps.readFn ?? defaultReadFn;
  const clearFn = deps.clearFn ?? defaultClearFn;
  const openBrowserFn = deps.openBrowserFn ?? openBrowser;

  let currentState: LoginState = { status: 'checking' };
  const listeners = new Set<() => void>();

  function setState(next: LoginState): void {
    currentState = next;
    for (const listener of listeners) {
      listener();
    }
  }

  function extractCredentials(
    envelope: StoredCredentialEnvelope | null,
  ): LoggedInCredentials | null {
    if (envelope === null) {
      return null;
    }

    if (
      envelope.terminal.mode === 'compat-oauth' &&
      envelope.terminal.credentials.expiresAt > Date.now()
    ) {
      return { type: 'oauth', credentials: envelope.terminal.credentials };
    }

    if (envelope.terminal.mode === 'api-key') {
      return { type: 'api-key', apiKey: envelope.terminal.apiKey };
    }

    return null;
  }

  // Init: read credentials on construction
  void (async () => {
    try {
      const envelope = await readFn();
      const credentials = extractCredentials(envelope);
      if (credentials !== null) {
        setState({ status: 'logged_in', credentials });
      } else {
        setState({ status: 'idle' });
      }
    } catch {
      setState({ status: 'idle' });
    }
  })();

  return {
    getState: () => currentState,

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async startLogin(mode: LoginMode = 'claudeai'): Promise<void> {
      if (
        currentState.status === 'checking' ||
        currentState.status === 'logging_in' ||
        currentState.status === 'logged_in'
      ) {
        return;
      }

      try {
        await loginFn(mode, {
          openBrowserFn: async (authUrl: string): Promise<boolean> => {
            setState({ status: 'logging_in', authUrl });
            return openBrowserFn(authUrl);
          },
        });

        const envelope = await readFn();
        const credentials = extractCredentials(envelope);
        if (credentials !== null) {
          setState({ status: 'logged_in', credentials });
        } else {
          setState({ status: 'idle' });
        }
      } catch (err) {
        const loginError =
          err instanceof LoginError
            ? err
            : new LoginError(
                err instanceof Error ? err.message : 'Login failed',
                'exchange_failed',
                err,
              );
        setState({ status: 'error', error: loginError });
      }
    },

    async logout(): Promise<void> {
      if (currentState.status !== 'logged_in') {
        return;
      }
      await clearFn();
      setState({ status: 'idle' });
    },

    reset(): void {
      if (currentState.status !== 'checking') {
        setState({ status: 'idle' });
      }
    },
  };
}

export const loginStore: LoginStore = createLoginStore();
