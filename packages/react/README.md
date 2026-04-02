# @claude-auth-sdk/react

[![npm version](https://img.shields.io/npm/v/%40claude-auth-sdk%2Freact?label=%40claude-auth-sdk%2Freact)](https://www.npmjs.com/package/@claude-auth-sdk/react)

React bindings for Claude auth SDK. Provides `useLoginState()` hook and `LoginStore` FSM.

See the [monorepo README](https://github.com/wickedev/claude-auth-sdk#readme) for the full docs and example app.

## Install

```bash
npm install @claude-auth-sdk/core @claude-auth-sdk/react
```

## Quick start

```tsx
import { useLoginState } from '@claude-auth-sdk/react';

function LoginScreen() {
  const { state, startLogin, logout } = useLoginState();

  switch (state.status) {
    case 'checking':
      return <p>Checking existing login…</p>;
    case 'idle':
      return <button onClick={() => void startLogin()}>Log in</button>;
    case 'logging_in':
      return <a href={state.authUrl}>Continue login</a>;
    case 'logged_in':
      return <button onClick={() => void logout()}>Log out</button>;
    case 'error':
      return <button onClick={() => void startLogin()}>Retry ({state.error.code})</button>;
  }
}
```

`useLoginState()` exposes a small auth state machine for React apps. It does not require a Provider or Context wrapper.

## State model

| Status | Description |
| --- | --- |
| `checking` | Reads stored credentials on initialization |
| `idle` | No valid credentials are available |
| `logging_in` | OAuth flow is in progress and exposes `authUrl` |
| `logged_in` | Authentication succeeded and credentials are available |
| `error` | Login failed with a `LoginError` |

## Credentials in the logged-in state

```ts
if (state.status === 'logged_in') {
  if (state.credentials.type === 'oauth') {
    console.log(state.credentials.credentials.accessToken);
  } else {
    console.log(state.credentials.apiKey);
  }
}
```

## Using the store without React

```ts
import { loginStore } from '@claude-auth-sdk/react';

loginStore.subscribe(() => {
  console.log(loginStore.getState());
});

await loginStore.startLogin();
await loginStore.logout();
loginStore.reset();
```

## API reference

| Export | Kind | Description |
| --- | --- | --- |
| `useLoginState()` | hook | Returns `{ state, startLogin, logout, reset }` |
| `loginStore` | object | Singleton `LoginStore` instance |
| `createLoginStore(deps?)` | function | Creates a store instance for custom integrations or tests |
| `LoginState` | type | Login state union |
| `LoginStore` | type | Store interface |
| `LoggedInCredentials` | type | Logged-in credential discriminated union |

## License

MIT
