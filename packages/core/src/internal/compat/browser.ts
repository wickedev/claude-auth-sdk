import { startBrowserAuth } from '../browser/initiate.js';
import {
  parseBrowserCallbackInput,
  parseBrowserManualCallback,
  parseBrowserRedirectCallback,
} from '../browser/parse.js';
import type {
  BrowserCompatAuthRequest,
  CompatBrowserAuthStartResult,
  ParsedBrowserCallbackPayload,
} from '../browser/types.js';
import { type CompatRuntimeConfigOverrides, createCompatRuntimeConfig } from './config.js';

export type CompatBrowserAuthRequest = BrowserCompatAuthRequest;

function withAuthorizeEndpoint(url: string, authorizeEndpoint: string): string {
  const parsed = new URL(url);
  const target = new URL(authorizeEndpoint);
  target.search = parsed.search;
  return target.toString();
}

export async function startCompatBrowserAuth(
  request: CompatBrowserAuthRequest,
  configOverrides: CompatRuntimeConfigOverrides = {},
): Promise<CompatBrowserAuthStartResult> {
  const config = createCompatRuntimeConfig(configOverrides);
  const result = await startBrowserAuth({
    ...request,
    clientId: request.clientId ?? config.constants.clientId,
    scope: request.scope ?? config.constants.scope,
    manualRedirectUri: request.manualRedirectUri ?? config.constants.manualRedirectUri,
  });

  if (result.lane !== 'compat') {
    throw new Error('Expected compat browser auth result while resolving compat entrypoint.');
  }

  const authorizeEndpoint = config.endpoints.authorize[request.mode];
  return {
    ...result,
    automaticRedirectUrl: withAuthorizeEndpoint(result.automaticRedirectUrl, authorizeEndpoint),
    manualRedirectUrl: withAuthorizeEndpoint(result.manualRedirectUrl, authorizeEndpoint),
  };
}

export { parseBrowserCallbackInput, parseBrowserRedirectCallback, parseBrowserManualCallback };
export type { ParsedBrowserCallbackPayload };
