import { UnsupportedRuntimeError } from '../core/errors.js';

const PKCE_VERIFIER_LENGTH_BYTES = 64;
const STATE_LENGTH_BYTES = 32;

function requireWebCrypto(): Crypto {
  if (typeof globalThis.crypto === 'undefined') {
    throw new UnsupportedRuntimeError(
      'browser',
      'Web Crypto API is required for browser auth initiation.',
    );
  }

  if (typeof globalThis.crypto.getRandomValues !== 'function') {
    throw new UnsupportedRuntimeError(
      'browser',
      'crypto.getRandomValues is unavailable in this runtime.',
    );
  }

  if (typeof globalThis.crypto.subtle === 'undefined') {
    throw new UnsupportedRuntimeError('browser', 'crypto.subtle is unavailable in this runtime.');
  }

  return globalThis.crypto;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  const base64 =
    typeof globalThis.btoa === 'function'
      ? globalThis.btoa(binary)
      : Buffer.from(binary, 'binary').toString('base64');

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createRandomBase64Url(byteLength: number): string {
  const crypto = requireWebCrypto();
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export function createState(): string {
  return createRandomBase64Url(STATE_LENGTH_BYTES);
}

export function createPkceVerifier(): string {
  return createRandomBase64Url(PKCE_VERIFIER_LENGTH_BYTES);
}

export async function createPkceChallenge(verifier: string): Promise<string> {
  const crypto = requireWebCrypto();
  const source = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', source);
  return bytesToBase64Url(new Uint8Array(digest));
}
