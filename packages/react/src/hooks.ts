import { useCallback, useSyncExternalStore } from 'react';
import type { LoginState } from './store.js';
import { loginStore } from './store.js';

const subscribe = (listener: () => void) => loginStore.subscribe(listener);
const getSnapshot = () => loginStore.getState();

export function useLoginState(): {
  state: LoginState;
  startLogin: () => Promise<void>;
  logout: () => Promise<void>;
  reset: () => void;
} {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  const startLogin = useCallback(() => loginStore.startLogin(), []);
  const logout = useCallback(() => loginStore.logout(), []);
  const reset = useCallback(() => {
    loginStore.reset();
  }, []);
  return { state, startLogin, logout, reset };
}
