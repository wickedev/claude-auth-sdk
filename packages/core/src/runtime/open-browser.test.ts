import { describe, expect, it, vi } from 'vitest';
import { openBrowser } from './open-browser.js';

describe('openBrowser', () => {
  it('calls the correct OS command for darwin', async () => {
    const execFile = vi.fn((_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
      cb(null);
    });

    await openBrowser('https://example.com', { platform: 'darwin', execFileFn: execFile });

    expect(execFile).toHaveBeenCalledOnce();
    expect(execFile.mock.calls[0][0]).toBe('open');
    expect(execFile.mock.calls[0][1]).toEqual(['https://example.com']);
  });

  it('calls xdg-open on linux', async () => {
    const execFile = vi.fn((_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
      cb(null);
    });

    await openBrowser('https://example.com', { platform: 'linux', execFileFn: execFile });

    expect(execFile.mock.calls[0][0]).toBe('xdg-open');
  });

  it('calls cmd /c start on win32', async () => {
    const execFile = vi.fn((_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
      cb(null);
    });

    await openBrowser('https://example.com', { platform: 'win32', execFileFn: execFile });

    expect(execFile.mock.calls[0][0]).toBe('cmd');
    expect(execFile.mock.calls[0][1]).toEqual(['/c', 'start', '', 'https://example.com']);
  });

  it('returns false when command fails', async () => {
    const execFile = vi.fn((_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
      cb(new Error('not found'));
    });

    const result = await openBrowser('https://example.com', {
      platform: 'darwin',
      execFileFn: execFile,
    });

    expect(result).toBe(false);
  });

  it('returns true on success', async () => {
    const execFile = vi.fn((_cmd: string, _args: string[], cb: (err: Error | null) => void) => {
      cb(null);
    });

    const result = await openBrowser('https://example.com', {
      platform: 'darwin',
      execFileFn: execFile,
    });

    expect(result).toBe(true);
  });
});
