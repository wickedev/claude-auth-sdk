import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { InvalidStateError, MissingAuthorizationCodeError } from '../core/errors.js';
import { startBrowserAuth } from './initiate.js';
import { parseBrowserCallbackInput } from './parse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('browser-init startBrowserAuth', () => {
  it('returns compat OAuth initiation payload for claudeai', async () => {
    const result = await startBrowserAuth({
      mode: 'claudeai',
      callbackUrl: 'http://127.0.0.1:3456/callback',
      state: 'abc123',
      pkceVerifier: 'fixed_verifier_for_test',
    });

    expect(result.lane).toBe('compat');
    if (result.lane !== 'compat') {
      throw new Error('Expected compat auth start result');
    }

    expect(result.lane).toBe('compat');
    expect(result.modeId).toBe('claudeai');
    expect(result.terminalMode).toBe('compat-oauth');
    expect(result.state).toBe('abc123');
    expect(result.automaticRedirectUrl).toContain('https://claude.com/cai/oauth/authorize');
    expect(result.automaticRedirectUrl).toContain('state=abc123');
    expect(result.automaticRedirectUrl).toContain(
      'redirect_uri=http%3A%2F%2F127.0.0.1%3A3456%2Fcallback',
    );
    expect(result.manualRedirectUrl).toContain(
      'redirect_uri=https%3A%2F%2Fplatform.claude.com%2Foauth%2Fcode%2Fcallback',
    );
    expect(result.pkce.verifier).toBe('fixed_verifier_for_test');
    expect(result.pkce.challengeMethod).toBe('S256');
    expect(result.pkce.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('returns provider instructions for official modes without oauth URLs', async () => {
    const result = await startBrowserAuth({
      mode: 'bedrock',
    });

    expect(result.lane).toBe('official');
    if (result.lane !== 'official') {
      throw new Error('Expected provider auth instruction result');
    }

    expect(result.lane).toBe('official');
    expect(result.modeId).toBe('bedrock');
    expect(result.terminalMode).toBe('official-provider');
    expect(result.providerInstructions.docsUrl).toContain('bedrock');
    expect(result.providerInstructions.credentialAdapterHint).toContain('credential adapter');
    expect(result).not.toHaveProperty('automaticRedirectUrl');
    expect(result).not.toHaveProperty('manualRedirectUrl');
  });
});

describe('browser-init callback parsing', () => {
  it('parses redirect callback URL into payload', () => {
    const parsed = parseBrowserCallbackInput({
      source: 'redirect-url',
      callback: 'http://127.0.0.1:3456/callback?code=code_123&state=abc123',
      expectedState: 'abc123',
    });

    expect(parsed.source).toBe('redirect-url');
    expect(parsed.mode).toBe('compat-oauth');
    expect(parsed.code).toBe('code_123');
    expect(parsed.state).toBe('abc123');
    expect(parsed.payload).toEqual({ code: 'code_123', state: 'abc123' });
  });

  it('parses manual callback input into payload', () => {
    const parsed = parseBrowserCallbackInput({
      source: 'manual-code',
      callback: 'code_999#abc123',
      expectedState: 'abc123',
    });

    expect(parsed.source).toBe('manual-code');
    expect(parsed.code).toBe('code_999');
    expect(parsed.state).toBe('abc123');
    expect(parsed.payload).toEqual({ code: 'code_999', state: 'abc123' });
  });

  it('throws InvalidStateError on mismatched state', () => {
    expect(() =>
      parseBrowserCallbackInput({
        source: 'redirect-url',
        callback: 'http://127.0.0.1:3456/callback?code=code_123&state=wrong_state',
        expectedState: 'abc123',
      }),
    ).toThrow(InvalidStateError);
  });

  it('throws MissingAuthorizationCodeError when code is absent', () => {
    expect(() =>
      parseBrowserCallbackInput({
        source: 'redirect-url',
        callback: 'http://127.0.0.1:3456/callback?state=abc123',
        expectedState: 'abc123',
      }),
    ).toThrow(MissingAuthorizationCodeError);
  });
});

async function collectTypeScriptFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectTypeScriptFiles(fullPath);
      }

      if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        return [fullPath];
      }

      return [];
    }),
  );

  return files.flat();
}

describe('browser-init import boundaries', () => {
  it('browser modules do not import server exchange/storage implementations', async () => {
    const sourceFiles = await collectTypeScriptFiles(__dirname);

    const forbiddenPatterns = [
      /from\s+['"][^'"]*\/server\//,
      /from\s+['"][^'"]*\/storage\//,
      /exchangeCodeForTokens/,
    ];

    for (const file of sourceFiles) {
      const contents = await readFile(file, 'utf8');
      for (const pattern of forbiddenPatterns) {
        expect(contents).not.toMatch(pattern);
      }
    }
  });

  it('public entrypoints stay browser-safe and do not pull node-only modules', async () => {
    const publicEntrypoints = [
      '../compat/index.ts',
      '../browser/index.ts',
      '../server/callback/index.ts',
      '../server/refresh/index.ts',
      '../official/index.ts',
    ];

    const forbiddenPatterns = [
      /from\s+['"][^'"]*node:fs[^'"]*['"]/,
      /from\s+['"][^'"]*node:child_process[^'"]*['"]/,
      /from\s+['"][^'"]*\/storage\/node\.js['"]/,
      /from\s+['"][^'"]*\/storage\/index\.js['"]/,
      /window\b/,
    ];

    for (const relativePath of publicEntrypoints) {
      const filePath = path.join(__dirname, relativePath);
      const contents = await readFile(filePath, 'utf8');

      for (const pattern of forbiddenPatterns) {
        expect(contents).not.toMatch(pattern);
      }
    }
  });
});
