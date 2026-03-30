import type { StorageAdapter } from '../core/contracts.js';
import { StorageFailureError } from '../core/errors.js';

export class BrowserStorageRequiredError extends StorageFailureError {
  public constructor() {
    super(
      'Browser runtime requires an explicit storage adapter; no default persistent browser storage is provided.',
    );
  }
}

export function requireBrowserStorageAdapter(
  adapter: StorageAdapter | null | undefined,
): StorageAdapter {
  if (adapter === null || adapter === undefined) {
    throw new BrowserStorageRequiredError();
  }

  return adapter;
}

export function createMemoryStorageAdapter(): StorageAdapter {
  let envelope: Awaited<ReturnType<StorageAdapter['read']>> = null;

  return {
    read() {
      return Promise.resolve(envelope);
    },
    write(value) {
      envelope = value;
      return Promise.resolve();
    },
    clear() {
      envelope = null;
      return Promise.resolve();
    },
  };
}
