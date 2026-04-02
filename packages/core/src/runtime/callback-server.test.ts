import { Agent, get } from 'node:http';
import { describe, expect, it } from 'vitest';
import { startCallbackServer } from './callback-server.js';

describe('callback-server', () => {
  it('starts on an available port and returns the port number', async () => {
    const { port, waitForCallback, close } = await startCallbackServer();

    expect(port).toBeGreaterThan(0);
    expect(typeof waitForCallback).toBe('function');

    await close();
  });

  it('receives callback with code and state from GET request', async () => {
    const { port, waitForCallback, close } = await startCallbackServer();

    const callbackPromise = waitForCallback();

    const response = await fetch(
      `http://localhost:${port}/callback?code=test_code&state=test_state`,
    );
    expect(response.ok).toBe(true);

    const result = await callbackPromise;
    expect(result.code).toBe('test_code');
    expect(result.state).toBe('test_state');

    await close();
  });

  it('receives callback with error parameter', async () => {
    const { port, waitForCallback, close } = await startCallbackServer();

    const callbackPromise = waitForCallback();

    await fetch(`http://localhost:${port}/callback?error=access_denied&state=test_state`);

    const result = await callbackPromise;
    expect(result.error).toBe('access_denied');
    expect(result.code).toBeUndefined();

    await close();
  });

  it('rejects waitForCallback on timeout', async () => {
    const { waitForCallback, close } = await startCallbackServer();

    await expect(waitForCallback(50)).rejects.toThrow('timeout');

    await close();
  });

  it('responds with success HTML to the browser', async () => {
    const { port, waitForCallback, close } = await startCallbackServer();

    const callbackPromise = waitForCallback();

    const response = await fetch(`http://localhost:${port}/callback?code=c&state=s`);
    const body = await response.text();

    expect(body).toContain('login');

    await callbackPromise;
    await close();
  });

  it('buffers a callback that arrives before waitForCallback is called', async () => {
    const { port, waitForCallback, close } = await startCallbackServer();

    const response = await fetch(
      `http://localhost:${port}/callback?code=early_code&state=early_state`,
    );
    expect(response.ok).toBe(true);

    await expect(waitForCallback(50)).resolves.toEqual({
      code: 'early_code',
      state: 'early_state',
      error: undefined,
      errorDescription: undefined,
    });

    await close();
  });

  it('responds to the callback with connection close semantics', async () => {
    const { port, waitForCallback, close } = await startCallbackServer();
    const callbackPromise = waitForCallback();
    const agent = new Agent({ keepAlive: true });

    try {
      const connectionHeader = await new Promise<string | string[] | undefined>(
        (resolve, reject) => {
          const req = get(
            {
              host: 'localhost',
              port,
              path: '/callback?code=close_me&state=done',
              agent,
            },
            (res) => {
              resolve(res.headers.connection);
              res.resume();
            },
          );

          req.on('error', reject);
        },
      );

      expect(connectionHeader).toBe('close');
      await expect(callbackPromise).resolves.toMatchObject({ code: 'close_me', state: 'done' });
    } finally {
      agent.destroy();
      await close();
    }
  });
});
