import { InvalidStateError, MissingAuthorizationCodeError } from '../../core/errors.js';

const LOCAL_CALLBACK_BASE_URL = 'http://localhost';

interface LocalhostCallbackParseRequest {
  callbackUrl: string;
  expectedState: string;
  callbackPath?: string;
}

interface ManualCodeParseRequest {
  manualCodeInput: string;
  expectedState: string;
}

export interface ParsedAuthorizationCode {
  code: string;
  state: string;
}

export function parseAuthorizationCodeFromLocalhostCallback(
  request: LocalhostCallbackParseRequest,
): ParsedAuthorizationCode {
  const callbackPath = request.callbackPath ?? '/callback';
  const parsedUrl = parseCallbackUrl(request.callbackUrl);

  if (parsedUrl.pathname !== callbackPath) {
    throw new MissingAuthorizationCodeError(
      `Callback URL pathname mismatch (expected "${callbackPath}", received "${parsedUrl.pathname}").`,
    );
  }

  const code = parsedUrl.searchParams.get('code') ?? undefined;
  const state = parsedUrl.searchParams.get('state') ?? undefined;

  return createValidatedAuthorizationCode(code, state, request.expectedState);
}

export function parseAuthorizationCodeFromManualInput(
  request: ManualCodeParseRequest,
): ParsedAuthorizationCode {
  const input = request.manualCodeInput.trim();
  const delimiterIndex = input.lastIndexOf('#');

  if (delimiterIndex <= 0 || delimiterIndex >= input.length - 1) {
    throw new MissingAuthorizationCodeError('Manual code input must be in the form "code#state".');
  }

  const code = input.slice(0, delimiterIndex);
  const state = input.slice(delimiterIndex + 1);

  return createValidatedAuthorizationCode(code, state, request.expectedState);
}

function createValidatedAuthorizationCode(
  code: string | undefined,
  state: string | undefined,
  expectedState: string,
): ParsedAuthorizationCode {
  if (!code) {
    throw new MissingAuthorizationCodeError();
  }

  validateCallbackState(state, expectedState);

  return { code, state };
}

function validateCallbackState(
  receivedState: string | undefined,
  expectedState: string,
): asserts receivedState is string {
  if (receivedState !== expectedState) {
    throw new InvalidStateError({ expectedState, receivedState });
  }
}

function parseCallbackUrl(callbackUrl: string): URL {
  try {
    return new URL(callbackUrl);
  } catch {
    return new URL(callbackUrl, LOCAL_CALLBACK_BASE_URL);
  }
}
