import type { LoginStoreDeps } from '@claude-auth-sdk/react';
import { createLoginStore } from '@claude-auth-sdk/react';

// --- WebSocket connection to Node API server ---

const WS_URL = `ws://${window.location.hostname}:3001`;

type ServerMessage =
  | { type: 'state'; data: unknown }
  | { type: 'authUrl'; url: string }
  | { type: 'loginResult'; data: unknown }
  | { type: 'chatDelta'; text: string }
  | { type: 'chatDone' }
  | { type: 'chatError'; message: string }
  | { type: 'error'; message: string };

let ws: WebSocket;
let messageHandlers: ((msg: ServerMessage) => void)[] = [];

function connect(): WebSocket {
  ws = new WebSocket(WS_URL);
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data as string) as ServerMessage;
    for (const handler of messageHandlers) {
      handler(msg);
    }
  });
  ws.addEventListener('close', () => {
    setTimeout(connect, 1000);
  });
  return ws;
}

function waitForOpen(): Promise<void> {
  if (ws.readyState === WebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve) => {
    ws.addEventListener('open', () => resolve(), { once: true });
  });
}

function wsSend(msg: Record<string, unknown>): void {
  ws.send(JSON.stringify(msg));
}

function waitFor(type: string): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const handler = (msg: ServerMessage) => {
      if (msg.type === type) {
        messageHandlers = messageHandlers.filter((h) => h !== handler);
        resolve(msg);
      } else if (msg.type === 'error') {
        messageHandlers = messageHandlers.filter((h) => h !== handler);
        reject(new Error((msg as { message: string }).message));
      }
    };
    messageHandlers.push(handler);
  });
}

connect();

// --- Chat API (exported for App.tsx) ---

export function onChatMessage(handler: (msg: ServerMessage) => void): () => void {
  messageHandlers.push(handler);
  return () => {
    messageHandlers = messageHandlers.filter((h) => h !== handler);
  };
}

export async function chatSend(message: string): Promise<void> {
  await waitForOpen();
  wsSend({ type: 'chatSend', message });
}

export async function chatAbort(): Promise<void> {
  await waitForOpen();
  wsSend({ type: 'chatAbort' });
}

export async function chatClear(): Promise<void> {
  await waitForOpen();
  wsSend({ type: 'chatClear' });
}

// --- LoginStoreDeps via WebSocket ---

const deps: LoginStoreDeps = {
  readFn: async () => {
    await waitForOpen();
    wsSend({ type: 'getState' });
    const msg = await waitFor('state');
    return (msg as { data: unknown }).data as ReturnType<LoginStoreDeps['readFn']> extends Promise<infer T> ? T : never;
  },

  clearFn: async () => {
    await waitForOpen();
    wsSend({ type: 'logout' });
    await waitFor('state');
  },

  openBrowserFn: async (url: string): Promise<boolean> => {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  },

  loginFn: async (mode, options) => {
    await waitForOpen();
    const authUrlPromise = waitFor('authUrl');
    const resultPromise = waitFor('loginResult');

    wsSend({ type: 'startLogin', mode });

    const authMsg = (await authUrlPromise) as { type: 'authUrl'; url: string };
    if (options?.openBrowserFn) {
      await options.openBrowserFn(authMsg.url);
    }

    const resultMsg = (await resultPromise) as { type: 'loginResult'; data: unknown };
    return resultMsg.data as { mode: 'claudeai' | 'console'; loggedIn: true };
  },
};

export const loginStore = createLoginStore(deps);
