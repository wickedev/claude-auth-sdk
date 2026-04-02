# @claude-auth-sdk/core

[![npm version](https://img.shields.io/npm/v/%40claude-auth-sdk%2Fcore?label=%40claude-auth-sdk%2Fcore)](https://www.npmjs.com/package/@claude-auth-sdk/core)

Core authentication SDK for Claude. Handles OAuth login, credential storage, and browser opening.

See the [monorepo README](https://github.com/wickedev/claude-auth-sdk#readme) for the full docs and example app.

## Install

```bash
npm install @claude-auth-sdk/core
```

## Quick start

```ts
import { login } from '@claude-auth-sdk/core';

await login('claudeai');
```

`login()` opens the browser for OAuth, waits for the callback, exchanges the authorization code for credentials, and stores them locally.

## Authentication modes

```ts
import { login } from '@claude-auth-sdk/core';

await login('claudeai');
await login('console');
```

| Mode | Result |
| --- | --- |
| `claudeai` | Stores OAuth access and refresh tokens |
| `console` | Exchanges the OAuth session for an API key |

## Options

```ts
await login('claudeai', {
  configDir: '/custom/path',
  openBrowserFn: async (url) => {
    // Custom browser launcher
  },
  fetchImpl: customFetch,
});
```

- `configDir` changes the credential storage directory from the default `~/.claude`.
- `openBrowserFn` lets you inject your own browser-opening behavior.
- `fetchImpl` lets you provide a custom `fetch` implementation.

## Error handling

```ts
import { LoginError, login } from '@claude-auth-sdk/core';

try {
  await login('claudeai');
} catch (error) {
  if (error instanceof LoginError) {
    console.error(error.code);
  }
}
```

Possible `LoginError.code` values:

- `cancelled`
- `timeout`
- `exchange_failed`
- `storage_failed`

## Reading stored credentials

```ts
import { createNodeDefaultStorageAdapter } from '@claude-auth-sdk/core';

const storage = createNodeDefaultStorageAdapter();
const envelope = await storage.read();

if (envelope?.terminal.mode === 'compat-oauth') {
  console.log(envelope.terminal.credentials.accessToken);
}
```

Credentials are stored in `~/.claude/` by default. On macOS, Keychain is used when available, with JSON files as a fallback.

## API reference

| Export | Kind | Description |
| --- | --- | --- |
| `login(mode, options?)` | function | Starts the OAuth login flow |
| `LoginError` | class | Error type with a machine-readable `code` |
| `createNodeDefaultStorageAdapter(options?)` | function | Creates the default Node.js credential storage adapter |
| `openBrowser(url)` | function | Opens a URL in the default browser |
| `LoginMode` | type | `'claudeai' \| 'console'` |
| `LoginResult` | type | Successful login result |
| `LoginErrorCode` | type | Login error code union |
| `LoginInternalOptions` | type | Optional login configuration |
| `OAuthCredentialBundle` | type | OAuth credential payload |
| `StoredCredentialEnvelope` | type | Stored credential envelope |

## License

MIT
