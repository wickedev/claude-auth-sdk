import http from 'node:http';
import os from 'node:os';
import {
  createNodeDefaultStorageAdapter,
  login,
} from '@claude-auth-sdk/core';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';

const PORT = 3001;
const storage = createNodeDefaultStorageAdapter();

// --- WebSocket message protocol ---
//
// Client → Server (Login):
//   { type: 'getState' }
//   { type: 'startLogin', mode: 'claudeai' | 'console' }
//   { type: 'logout' }
//   { type: 'reset' }
//
// Server → Client (Login):
//   { type: 'state', data: StoredCredentialEnvelope | null }
//   { type: 'authUrl', url: string }
//   { type: 'loginResult', data: LoginResult }
//   { type: 'error', message: string }
//
// Client → Server (Chat):
//   { type: 'chatSend', message: string }
//   { type: 'chatAbort' }
//   { type: 'chatClear' }
//
// Server → Client (Chat):
//   { type: 'chatDelta', text: string }
//   { type: 'chatDone' }
//   { type: 'chatError', message: string }

let loginInProgress = false;

function send(ws: WebSocket, msg: Record<string, unknown>): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// --- Chat state (per connection) ---

interface ChatState {
  activeQuery: AsyncGenerator | null;
  sessionId: string | null;
}

const chatStates = new WeakMap<WebSocket, ChatState>();

function getChatState(ws: WebSocket): ChatState {
  let state = chatStates.get(ws);
  if (!state) {
    state = { activeQuery: null, sessionId: null };
    chatStates.set(ws, state);
  }
  return state;
}

// --- Lazy-loaded SDK ---

let sdkLoaded: {
  query: typeof import('@anthropic-ai/claude-agent-sdk').query;
  tool: typeof import('@anthropic-ai/claude-agent-sdk').tool;
  createSdkMcpServer: typeof import('@anthropic-ai/claude-agent-sdk').createSdkMcpServer;
  z: typeof import('zod').z;
} | null = null;

async function loadSdk() {
  if (sdkLoaded) return sdkLoaded;
  const { query, tool, createSdkMcpServer } = await import('@anthropic-ai/claude-agent-sdk');
  const { z } = await import('zod');
  sdkLoaded = { query, tool, createSdkMcpServer, z };
  return sdkLoaded;
}

// --- HTTP + WebSocket Server ---

const server = http.createServer((_req, res) => {
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    void handleMessage(ws, raw.toString());
  });
  ws.on('close', () => {
    const chat = chatStates.get(ws);
    if (chat?.activeQuery) {
      void chat.activeQuery.return(undefined);
    }
  });
});

async function handleMessage(ws: WebSocket, raw: string): Promise<void> {
  let msg: { type: string; mode?: string; message?: string };
  try {
    msg = JSON.parse(raw);
  } catch {
    send(ws, { type: 'error', message: 'Invalid JSON' });
    return;
  }

  try {
    switch (msg.type) {
      // --- Login ---
      case 'getState': {
        const envelope = await storage.read();
        send(ws, { type: 'state', data: envelope });
        break;
      }

      case 'startLogin': {
        if (loginInProgress) {
          send(ws, { type: 'error', message: 'Login already in progress' });
          return;
        }
        loginInProgress = true;
        const mode = msg.mode === 'console' ? 'console' as const : 'claudeai' as const;
        try {
          const result = await login(mode, {
            openBrowserFn: async (authUrl: string): Promise<boolean> => {
              send(ws, { type: 'authUrl', url: authUrl });
              return false;
            },
          });
          send(ws, { type: 'loginResult', data: result });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Login failed';
          send(ws, { type: 'error', message });
        } finally {
          loginInProgress = false;
        }
        break;
      }

      case 'logout': {
        await storage.clear();
        send(ws, { type: 'state', data: null });
        break;
      }

      case 'reset': {
        loginInProgress = false;
        send(ws, { type: 'state', data: null });
        break;
      }

      // --- Chat ---
      case 'chatSend': {
        const userMessage = msg.message;
        if (!userMessage) {
          send(ws, { type: 'chatError', message: 'No message provided' });
          return;
        }
        await handleChatSend(ws, userMessage);
        break;
      }

      case 'chatAbort': {
        const chat = getChatState(ws);
        if (chat.activeQuery) {
          void chat.activeQuery.return(undefined);
          chat.activeQuery = null;
        }
        break;
      }

      case 'chatClear': {
        const chat = getChatState(ws);
        chat.sessionId = null;
        break;
      }

      default:
        send(ws, { type: 'error', message: `Unknown message type: ${msg.type}` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    send(ws, { type: 'error', message });
  }
}

async function handleChatSend(ws: WebSocket, userMessage: string): Promise<void> {
  const sdk = await loadSdk();
  const chat = getChatState(ws);

  const currentTimeTool = sdk.tool(
    'current_time',
    'Get the current date and time',
    { timezone: sdk.z.string().optional().describe('IANA timezone, e.g. Asia/Seoul') },
    ({ timezone }) => {
      const formatted = new Date().toLocaleString('ko-KR', {
        timeZone: timezone ?? 'Asia/Seoul',
        dateStyle: 'full',
        timeStyle: 'long',
      });
      return Promise.resolve({ content: [{ type: 'text' as const, text: formatted }] });
    },
  );

  const diceRollTool = sdk.tool(
    'roll_dice',
    'Roll one or more dice',
    {
      sides: sdk.z.number().optional().describe('Number of sides (default 6)'),
      count: sdk.z.number().optional().describe('Number of dice to roll (default 1)'),
    },
    ({ sides, count }) => {
      const s = sides || 6;
      const c = count || 1;
      const rolls = Array.from({ length: c }, () => Math.floor(Math.random() * s) + 1);
      return Promise.resolve({
        content: [{ type: 'text' as const, text: `Rolled ${c}d${s}: [${rolls.join(', ')}] = ${rolls.reduce((a, b) => a + b, 0)}` }],
      });
    },
  );

  const toolServer = sdk.createSdkMcpServer({
    name: 'demo-tools',
    tools: [currentTimeTool, diceRollTool],
  });

  try {
    chat.activeQuery = sdk.query({
      prompt: userMessage,
      ...(chat.sessionId ? { resume: chat.sessionId } : {}),
      options: {
        cwd: os.homedir(),
        tools: [],
        maxTurns: 3,
        includePartialMessages: true,
        settingSources: [],
        systemPrompt: 'You are a helpful assistant. Respond concisely. Use tools when relevant.',
        mcpServers: { demo: toolServer },
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
      },
    });

    for await (const msg of chat.activeQuery) {
      const m = msg as Record<string, unknown>;

      if (typeof m.session_id === 'string' && !chat.sessionId) {
        chat.sessionId = m.session_id;
      }

      // Auth errors → tell client
      if (m.error === 'authentication_failed') {
        send(ws, { type: 'chatError', message: 'Session expired. Please log in again.' });
        return;
      }
      if (m.type === 'auth_status' && m.error) {
        send(ws, { type: 'chatError', message: 'Authentication failed. Please log in again.' });
        return;
      }
      if (m.type === 'result' && typeof m.subtype === 'string' && m.subtype.startsWith('error')) {
        const errors = m.errors as string[] | undefined;
        send(ws, { type: 'chatError', message: errors?.join('; ') ?? 'Unknown error' });
        return;
      }

      // Stream text deltas
      const event = (m as { event?: { type?: string; delta?: { type?: string; text?: string } } }).event;
      if (m.type === 'stream_event' && event?.type === 'content_block_delta') {
        const delta = event.delta;
        if (delta?.type === 'text_delta' && delta.text) {
          send(ws, { type: 'chatDelta', text: delta.text });
        }
      }
    }

    send(ws, { type: 'chatDone' });
  } catch (err) {
    if (err instanceof Error && err.name !== 'AbortError') {
      send(ws, { type: 'chatError', message: err.message || 'Chat failed' });
    }
  } finally {
    chat.activeQuery = null;
  }
}

server.listen(PORT, () => {
  // biome-ignore lint/suspicious/noConsole: server startup log
  console.log(`API server (WebSocket) listening on ws://localhost:${PORT}`);
});
