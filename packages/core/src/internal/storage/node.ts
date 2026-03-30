import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import type { StorageAdapter, StoredCredentialEnvelope } from '../core/contracts.js';
import { StorageFailureError } from '../core/errors.js';
import {
  serializeOAuthTerminalState,
  toStoredEnvelopeFromNativeShapes,
  updateConfigWithApiKey,
} from './normalize.js';
import type {
  ConfigFileShape,
  CredentialsFileShape,
  NodeCredentialPaths,
  NodeStorageAdapterOptions,
} from './types.js';

const CREDENTIALS_FILE_NAME = '.credentials.json';
const CONFIG_FILE_NAME = 'config.json';

function isErrnoCode(error: unknown, code: string): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}

async function readJsonOrDefault<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(content) as unknown;
    return (parsed as T) ?? defaultValue;
  } catch (error) {
    if (isErrnoCode(error, 'ENOENT')) {
      return defaultValue;
    }

    throw new StorageFailureError(`Failed to read storage file: ${filePath}`, error);
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(value, null, 2), { mode: 0o600, encoding: 'utf8' });
  } catch (error) {
    throw new StorageFailureError(`Failed to write storage file: ${filePath}`, error);
  }
}

async function safeUnlink(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (isErrnoCode(error, 'ENOENT')) {
      return;
    }

    throw new StorageFailureError(`Failed to remove storage file: ${filePath}`, error);
  }
}

async function getUpdatedAt(paths: NodeCredentialPaths): Promise<number> {
  const mtimes: number[] = [];
  for (const filePath of [paths.credentialsFilePath, paths.configFilePath]) {
    try {
      const metadata = await stat(filePath);
      mtimes.push(metadata.mtimeMs);
    } catch (error) {
      if (!isErrnoCode(error, 'ENOENT')) {
        throw new StorageFailureError(`Failed to stat storage file: ${filePath}`, error);
      }
    }
  }

  if (mtimes.length === 0) {
    return Date.now();
  }

  return Math.max(...mtimes);
}

async function readNativeShapes(paths: NodeCredentialPaths): Promise<{
  credentialsFile: CredentialsFileShape;
  configFile: ConfigFileShape;
}> {
  const [credentialsFile, configFile] = await Promise.all([
    readJsonOrDefault<CredentialsFileShape>(paths.credentialsFilePath, {}),
    readJsonOrDefault<ConfigFileShape>(paths.configFilePath, {}),
  ]);

  return {
    credentialsFile,
    configFile,
  };
}

function isMacOS(platform: NodeJS.Platform): boolean {
  return platform === 'darwin';
}

export function resolveNodeCredentialPaths(configDir?: string): NodeCredentialPaths {
  const resolvedConfigDir =
    configDir ?? process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');

  return {
    configDir: resolvedConfigDir,
    credentialsFilePath: join(resolvedConfigDir, CREDENTIALS_FILE_NAME),
    configFilePath: join(resolvedConfigDir, CONFIG_FILE_NAME),
  };
}

export function createNodeDefaultStorageAdapter(
  options: NodeStorageAdapterOptions = {},
): StorageAdapter {
  const paths = resolveNodeCredentialPaths(options.configDir);
  const platform = options.platform ?? process.platform;
  const secureStorage = options.secureStorage;
  const secureFirst = isMacOS(platform) && secureStorage !== undefined;

  const readSecureFirst = async (): Promise<StoredCredentialEnvelope | null> => {
    if (!secureFirst) {
      return null;
    }

    const oauthRecord = await secureStorage.readOAuth?.();
    if (oauthRecord !== null && oauthRecord !== undefined) {
      return {
        terminal: {
          mode: 'compat-oauth',
          credentials: {
            accessToken: oauthRecord.accessToken,
            refreshToken: oauthRecord.refreshToken,
            expiresAt: oauthRecord.expiresAt,
            scopes: oauthRecord.scopes,
          },
          providerKey: 'claudeai',
          providerLabel: 'Claude.ai compatibility lane',
        },
        updatedAt: Date.now(),
      };
    }

    const apiKey = await secureStorage.readApiKey?.();
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      return {
        terminal: {
          mode: 'api-key',
          apiKey,
          source: 'derived-from-console-oauth',
        },
        updatedAt: Date.now(),
      };
    }

    return null;
  };

  return {
    async read(): Promise<StoredCredentialEnvelope | null> {
      if (secureFirst) {
        const secureValue = await readSecureFirst();
        if (secureValue !== null) {
          return secureValue;
        }
      }

      const nativeShapes = await readNativeShapes(paths);
      const updatedAt = await getUpdatedAt(paths);
      return toStoredEnvelopeFromNativeShapes({
        ...nativeShapes,
        updatedAt,
      });
    },

    async write(envelope: StoredCredentialEnvelope): Promise<void> {
      if (envelope.terminal.mode === 'api-key') {
        if (secureFirst && secureStorage.writeApiKey !== undefined) {
          await secureStorage.writeApiKey(envelope.terminal.apiKey);
        }

        const configFile = await readJsonOrDefault<ConfigFileShape>(paths.configFilePath, {});
        const nextConfigFile = updateConfigWithApiKey({
          configFile,
          terminal: envelope.terminal,
        });

        await writeJson(paths.configFilePath, nextConfigFile);

        const credentialsFile = await readJsonOrDefault<CredentialsFileShape>(
          paths.credentialsFilePath,
          {},
        );
        if (credentialsFile.claudeAiOauth !== undefined) {
          const { claudeAiOauth: _omit, ...rest } = credentialsFile;
          await writeJson(paths.credentialsFilePath, rest);
        }

        return;
      }

      const oauthRecord = serializeOAuthTerminalState(envelope.terminal);
      if (secureFirst && secureStorage.writeOAuth !== undefined) {
        await secureStorage.writeOAuth(oauthRecord);
      }

      const credentialsFile = await readJsonOrDefault<CredentialsFileShape>(
        paths.credentialsFilePath,
        {},
      );
      const nextCredentialsFile: CredentialsFileShape = {
        ...credentialsFile,
        claudeAiOauth: oauthRecord,
      };

      await writeJson(paths.credentialsFilePath, nextCredentialsFile);
    },

    async clear(): Promise<void> {
      if (secureFirst) {
        await Promise.all([secureStorage.clearOAuth?.(), secureStorage.clearApiKey?.()]);
      }

      await Promise.all([safeUnlink(paths.credentialsFilePath), safeUnlink(paths.configFilePath)]);
    },
  };
}
