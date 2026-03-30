import { type LoginError, login } from '@claude-auth-sdk/core';

try {
  const result = await login('claudeai');
  console.log('Login result:', result);
} catch (err) {
  const e = err as LoginError;
  console.error('Login failed:', e.code, e.message);
}
