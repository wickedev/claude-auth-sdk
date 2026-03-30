import { execFile as defaultExecFile } from 'node:child_process';

type ExecFileFn = (cmd: string, args: string[], cb: (err: Error | null) => void) => void;

export interface OpenBrowserOptions {
  platform?: NodeJS.Platform;
  execFileFn?: ExecFileFn;
}

export async function openBrowser(url: string, options: OpenBrowserOptions = {}): Promise<boolean> {
  const platform = options.platform ?? process.platform;
  const execFileFn: ExecFileFn = options.execFileFn ?? defaultExecFile;

  const { cmd, args } = getOpenCommand(platform, url);

  return new Promise<boolean>((resolve) => {
    execFileFn(cmd, args, (err) => {
      resolve(err === null);
    });
  });
}

function getOpenCommand(platform: NodeJS.Platform, url: string): { cmd: string; args: string[] } {
  switch (platform) {
    case 'darwin':
      return { cmd: 'open', args: [url] };
    case 'win32':
      return { cmd: 'cmd', args: ['/c', 'start', '', url] };
    default:
      return { cmd: 'xdg-open', args: [url] };
  }
}
