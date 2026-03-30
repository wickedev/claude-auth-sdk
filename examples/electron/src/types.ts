import type { LoginMode } from '@claude-auth-sdk/core';

export interface SerializedLoginState {
  status: 'checking' | 'idle' | 'logging_in' | 'logged_in' | 'error';
  authUrl?: string;
  credentials?: SerializedCredentials;
  error?: { message: string; code: string };
}

export type SerializedCredentials =
  | {
      type: 'oauth';
      credentials: {
        accessToken: string;
        refreshToken: string;
        expiresAt: number;
        scopes: readonly string[];
      };
    }
  | { type: 'api-key'; apiKey: string };

export interface LoginAPI {
  getState(): Promise<SerializedLoginState>;
  startLogin(mode?: LoginMode): Promise<void>;
  logout(): Promise<void>;
  reset(): Promise<void>;
  onStateChanged(callback: (state: SerializedLoginState) => void): () => void;
}

export interface ChatAPI {
  send(message: string): Promise<void>;
  abort(): Promise<void>;
  clear(): Promise<void>;
  onDelta(callback: (text: string) => void): () => void;
  onDone(callback: () => void): () => void;
  onError(callback: (error: string) => void): () => void;
}

declare global {
  interface Window {
    loginAPI: LoginAPI;
    chatAPI: ChatAPI;
    shellAPI: { openExternal: (url: string) => Promise<void> };
  }
}
