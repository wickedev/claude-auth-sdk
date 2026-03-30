# Contributing

## Monorepo structure

```
packages/
  core/       — @claude-auth-sdk/core
  react/      — @claude-auth-sdk/react
examples/
  electron/   — Electron example app
  node/       — Node.js example
```

## Development

```bash
npm install
npm run build       # Build all packages
npm test            # Run all tests
npm run typecheck   # Type-check all packages
```

## Testing the React store

`createLoginStore` accepts dependency injection for tests:

```ts
import { createLoginStore } from '@claude-auth-sdk/react';

const store = createLoginStore({
  loginFn: async (mode, opts) => {
    await opts?.openBrowserFn?.('https://example.com/auth');
    return { mode, loggedIn: true };
  },
  readFn: async () => null,
  clearFn: async () => {},
  openBrowserFn: async () => true,
});
```
