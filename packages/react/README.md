# @claude-auth-sdk/react

React bindings for Claude auth SDK. Provides `useLoginState()` hook and `LoginStore` FSM.

See the [monorepo README](https://github.com/anthropics/claude-auth-sdk#readme) for full documentation.

## Quick start

```tsx
import { useLoginState } from '@claude-auth-sdk/react';

function LoginScreen() {
  const { state, startLogin, logout } = useLoginState();

  if (state.status === 'idle') {
    return <button onClick={startLogin}>Log in</button>;
  }
}
```

## License

MIT
