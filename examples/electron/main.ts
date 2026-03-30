import { execSync } from 'node:child_process';
import path from 'node:path';
import type { LoginState, LoginStore } from '@claude-auth-sdk/react';
import { BrowserWindow, app, ipcMain, shell } from 'electron';
import type { SerializedLoginState } from './src/types.js';

function findClaudeExecutable(): string {
  try {
    return execSync('which claude', { encoding: 'utf8' }).trim();
  } catch {
    return require.resolve('@anthropic-ai/claude-code/cli.js').replace('app.asar', 'app.asar.unpacked');
  }
}

let win: BrowserWindow | null = null;
let loginStore: LoginStore;

function serializeState(state: LoginState): SerializedLoginState {
  if (state.status === 'error') {
    return {
      status: 'error',
      error: { message: state.error.message, code: state.error.code },
    };
  }
  return JSON.parse(JSON.stringify(state)) as SerializedLoginState;
}

async function initLoginStore(): Promise<void> {
  const sdk = await import('@claude-auth-sdk/react');
  loginStore = sdk.loginStore;

  loginStore.subscribe(() => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('login-state-changed', serializeState(loginStore.getState()));
    }
  });

  ipcMain.handle('login:getState', () => serializeState(loginStore.getState()));

  ipcMain.handle('login:startLogin', async (_event, mode?: string) => {
    await loginStore.startLogin(mode === 'console' ? 'console' : 'claudeai');
  });

  ipcMain.handle('login:logout', async () => {
    await loginStore.logout();
  });

  ipcMain.handle('login:reset', () => {
    loginStore.reset();
  });

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
  });
}

async function initChat(): Promise<void> {
  let activeQuery: AsyncGenerator | null = null;
  const { query, tool, createSdkMcpServer } = await import('@anthropic-ai/claude-agent-sdk');
  const { z } = await import('zod');

  const currentTimeTool = tool(
    'current_time',
    'Get the current date and time',
    {
      timezone: z.string().optional().describe('IANA timezone, e.g. Asia/Seoul'),
    },

    ({ timezone }) => {
      const now = new Date();
      const formatted = now.toLocaleString('ko-KR', {
        timeZone: timezone ?? 'Asia/Seoul',
        dateStyle: 'full',
        timeStyle: 'long',
      });
      return Promise.resolve({
        content: [{ type: 'text' as const, text: formatted }],
      });
    },
  );

  const diceRollTool = tool(
    'roll_dice',
    'Roll one or more dice',
    {
      sides: z.number().optional().describe('Number of sides (default 6)'),
      count: z.number().optional().describe('Number of dice to roll (default 1)'),
    },

    ({ sides, count }) => {
      const s = sides || 6;
      const c = count || 1;
      const rolls = Array.from({ length: c }, () => Math.floor(Math.random() * s) + 1);
      return Promise.resolve({
        content: [
          {
            type: 'text' as const,
            text: `Rolled ${c}d${s}: [${rolls.join(', ')}] = ${rolls.reduce((a, b) => a + b, 0)}`,
          },
        ],
      });
    },
  );

  const toolServer = createSdkMcpServer({
    name: 'demo-tools',
    tools: [currentTimeTool, diceRollTool],
  });

  ipcMain.handle('chat:send', async (_event, userMessage: string) => {
    try {
      activeQuery = query({
        prompt: userMessage,
        options: {
          cwd: app.getPath('home'),
          pathToClaudeCodeExecutable: findClaudeExecutable(),
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

      for await (const msg of activeQuery) {
        if (win && !win.isDestroyed()) {
          const m = msg as {
            type?: string;
            event?: { type?: string; delta?: { type?: string; text?: string } };
          };
          if (m.type === 'stream_event' && m.event?.type === 'content_block_delta') {
            const delta = m.event.delta;
            if (delta?.type === 'text_delta' && delta.text) {
              win.webContents.send('chat:delta', delta.text);
            }
          }
        }
      }

      if (win && !win.isDestroyed()) {
        win.webContents.send('chat:done');
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        if (win && !win.isDestroyed()) {
          win.webContents.send('chat:error', err.message || 'Chat failed');
        }
      }
    } finally {
      activeQuery = null;
    }
  });

  ipcMain.handle('chat:abort', () => {
    if (activeQuery) {
      void activeQuery.return(undefined);
      activeQuery = null;
    }
  });
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 700,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  void win.loadFile(path.join(__dirname, '..', 'index.html'));
}

void app.whenReady().then(async () => {
  await initLoginStore();
  await initChat();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
