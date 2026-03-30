import { InvalidStateError, MissingAuthorizationCodeError } from '../core/errors.js';
import type { ServerCallbackPayload } from '../core/types.js';
import type { ParseBrowserCallbackInput, ParsedBrowserCallbackPayload } from './types.js';

function toPayloadFromRedirect(callback: string | URL): ServerCallbackPayload {
  const url = callback instanceof URL ? callback : new URL(callback);

  return {
    code: url.searchParams.get('code') ?? undefined,
    state: url.searchParams.get('state') ?? undefined,
    error: url.searchParams.get('error') ?? undefined,
    errorDescription: url.searchParams.get('error_description') ?? undefined,
  };
}

function toPayloadFromManualCode(rawValue: string): ServerCallbackPayload {
  const trimmed = rawValue.trim();
  const separatorIndex = trimmed.lastIndexOf('#');

  if (separatorIndex < 0) {
    return {
      code: trimmed || undefined,
      state: undefined,
    };
  }

  const code = trimmed.slice(0, separatorIndex).trim();
  const state = trimmed.slice(separatorIndex + 1).trim();

  return {
    code: code || undefined,
    state: state || undefined,
  };
}

function ensureStateMatches(payload: ServerCallbackPayload, expectedState?: string): void {
  if (expectedState === undefined) {
    return;
  }

  if (payload.state !== expectedState) {
    throw new InvalidStateError({
      expectedState,
      receivedState: payload.state,
    });
  }
}

function ensureCodeExists(payload: ServerCallbackPayload): string {
  if (payload.code === undefined || payload.code.length === 0) {
    throw new MissingAuthorizationCodeError();
  }

  return payload.code;
}

export function parseBrowserCallbackInput(
  input: ParseBrowserCallbackInput,
): ParsedBrowserCallbackPayload {
  const payload =
    input.source === 'redirect-url'
      ? toPayloadFromRedirect(input.callback)
      : toPayloadFromManualCode(input.callback);

  ensureStateMatches(payload, input.expectedState);

  const code = ensureCodeExists(payload);
  return {
    source: input.source,
    mode: 'compat-oauth',
    payload,
    code,
    state: payload.state,
  };
}

export function parseBrowserRedirectCallback(params: {
  callback: string | URL;
  expectedState?: string;
}): ParsedBrowserCallbackPayload {
  return parseBrowserCallbackInput({
    source: 'redirect-url',
    callback: params.callback,
    expectedState: params.expectedState,
  });
}

export function parseBrowserManualCallback(params: {
  callback: string;
  expectedState?: string;
}): ParsedBrowserCallbackPayload {
  return parseBrowserCallbackInput({
    source: 'manual-code',
    callback: params.callback,
    expectedState: params.expectedState,
  });
}
