import type { LoginMode } from '@claude-auth-sdk/core/browser';
import { useCallback, useSyncExternalStore } from 'react';
import type { LoginState, LoginStore } from './store.js';

export function useLoginState(store: LoginStore): {
  state: LoginState;
  startLogin: (mode?: LoginMode) => Promise<void>;
  logout: () => Promise<void>;
  reset: () => void;
} {
  const state = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getState(),
  );
  const startLogin = useCallback((mode?: LoginMode) => store.startLogin(mode), [store]);
  const logout = useCallback(() => store.logout(), [store]);
  const reset = useCallback(() => {
    store.reset();
  }, [store]);
  return { state, startLogin, logout, reset };
}
