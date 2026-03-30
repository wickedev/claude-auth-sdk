export {
  createMemoryStorageAdapter as createCompatMemoryStorageAdapter,
  BrowserStorageRequiredError as CompatBrowserStorageRequiredError,
  requireBrowserStorageAdapter as requireCompatBrowserStorageAdapter,
} from '../storage/browser.js';
export {
  createNodeDefaultStorageAdapter as createCompatNodeStorageAdapter,
  resolveNodeCredentialPaths as resolveCompatNodeCredentialPaths,
} from '../storage/node.js';
export type {
  NodeStorageAdapterOptions as CompatNodeStorageAdapterOptions,
  SecureStorageAdapter as CompatSecureStorageAdapter,
  NodeCredentialPaths as CompatNodeCredentialPaths,
  ClaudeAiOauthStorageRecord as CompatOAuthStorageRecord,
  CredentialsFileShape as CompatCredentialsFileShape,
  ConfigFileShape as CompatConfigFileShape,
} from '../storage/types.js';
