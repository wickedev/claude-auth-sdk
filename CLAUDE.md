# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run build          # Build all packages (tsup)
npm test               # Run all tests (vitest)
npm run typecheck      # Type-check all packages
npm run lint           # Lint packages/ and examples/
npm run lint:fix       # Auto-fix lint issues

# Single package
npm run build -w packages/core
npm run test -w packages/core
npm run typecheck -w packages/core

# Run a single test file
npx vitest run packages/core/src/internal/storage/storage.test.ts
```

## Architecture

Monorepo with npm workspaces: `packages/*` and `examples/*`.

### Packages

- **`@claude-auth-sdk/core`** — OAuth/PKCE authentication, token exchange, credential storage. Entry point: `packages/core/src/index.ts`. Main function is `login(mode, options?)` which launches a local callback server, opens the browser for OAuth, and stores resulting credentials.
- **`@claude-auth-sdk/react`** — React hooks (`useLoginState()`) and a singleton `LoginStore` implementing a finite state machine (states: `checking` → `idle` → `logging_in` → `logged_in` | `error`). Uses `useSyncExternalStore` for subscriptions. Supports dependency injection for testing.

### Core Internal Structure

- `internal/browser/` — PKCE challenge/verifier generation, OAuth URL construction, constants (client IDs, endpoints, scopes)
- `internal/server/callback/` — OAuth callback handler and token exchange
- `internal/server/refresh/` — Token refresh logic
- `internal/storage/` — Node.js storage adapters (writes to `~/.claude/` by default: `.credentials.json` for OAuth tokens, `config.json` for API keys). macOS tries Keychain first.
- `internal/compat/` — Legacy OAuth compatibility layer
- `internal/official/` — Provider-specific adapters (Bedrock, Vertex, Foundry)
- `runtime/` — Callback HTTP server and cross-platform browser opener

### Authentication Modes

Two `LoginMode` values: `claudeai` and `console`. Each uses different OAuth authorize URLs and post-auth flows. Console mode creates an API key from the OAuth access token.

### Credential Types (Discriminated Unions)

- `compat-oauth` — accessToken, refreshToken, expiresAt, scopes
- `api-key` — raw API key string

### Error Codes

`LoginError` with codes: `cancelled`, `timeout` (120s default), `exchange_failed`, `storage_failed`.

## Code Conventions

- ESM-only (no CommonJS). TypeScript strict mode. Target ES2022.
- Inline type imports: `import { type Foo } from '...'`
- Unused variables must be underscore-prefixed
- Non-null assertions are warnings, not errors
- Dependency injection pattern for testability (loginFn, readFn, clearFn, openBrowserFn)
- Test files colocated with source using `.test.ts` suffix
- File permissions `0o600` for credential files
