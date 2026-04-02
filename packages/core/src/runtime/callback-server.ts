import { createServer } from 'node:http';

export interface CallbackParams {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}

export interface CallbackServerHandle {
  port: number;
  waitForCallback: (timeoutMs?: number) => Promise<CallbackParams>;
  close: () => Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 120_000;

const SUCCESS_HTML = `<!DOCTYPE html>
<html><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
<div style="text-align:center">
<h2>login successful</h2>
<p id="msg">This tab will close in <span id="count">3</span> seconds...</p>
</div>
<script>
let n=3;
const c=document.getElementById("count");
const m=document.getElementById("msg");
const t=setInterval(()=>{n--;if(n>0){c.textContent=n}else{clearInterval(t);window.close();m.textContent="You can close this tab."}},1000);
</script>
</body></html>`;

export async function startCallbackServer(): Promise<CallbackServerHandle> {
  let pendingCallback: CallbackParams | undefined;
  let resolveCallback: ((params: CallbackParams) => void) | undefined;
  let timeoutHandle: NodeJS.Timeout | undefined;

  function clearPendingWait(): void {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
      timeoutHandle = undefined;
    }
    resolveCallback = undefined;
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname !== '/callback') {
      res.writeHead(404);
      res.end();
      return;
    }

    const params: CallbackParams = {
      code: url.searchParams.get('code') ?? undefined,
      state: url.searchParams.get('state') ?? undefined,
      error: url.searchParams.get('error') ?? undefined,
      errorDescription: url.searchParams.get('error_description') ?? undefined,
    };

    res.shouldKeepAlive = false;
    res.writeHead(200, { 'Content-Type': 'text/html', Connection: 'close' });
    res.end(SUCCESS_HTML);

    if (resolveCallback !== undefined) {
      const resolve = resolveCallback;
      clearPendingWait();
      resolve(params);
      return;
    }

    pendingCallback = params;
  });

  const port = await new Promise<number>((resolve, reject) => {
    server.listen(0, 'localhost', () => {
      const addr = server.address();
      if (addr === null || typeof addr === 'string') {
        reject(new Error('Failed to bind callback server'));
        return;
      }
      resolve(addr.port);
    });
  });

  return {
    port,

    waitForCallback(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<CallbackParams> {
      if (pendingCallback !== undefined) {
        const buffered = pendingCallback;
        pendingCallback = undefined;
        return Promise.resolve(buffered);
      }

      return new Promise<CallbackParams>((resolve, reject) => {
        resolveCallback = resolve;

        timeoutHandle = setTimeout(() => {
          clearPendingWait();
          reject(new Error('Login timeout: no callback received'));
        }, timeoutMs);

        timeoutHandle.unref();
      });
    },

    close(): Promise<void> {
      return new Promise<void>((resolve) => {
        server.closeIdleConnections?.();
        server.close(() => {
          resolve();
        });
      });
    },
  };
}
