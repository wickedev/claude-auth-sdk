import { type IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('loginAPI', {
  getState: () => ipcRenderer.invoke('login:getState'),
  startLogin: (mode?: string) => ipcRenderer.invoke('login:startLogin', mode),
  logout: () => ipcRenderer.invoke('login:logout'),
  reset: () => ipcRenderer.invoke('login:reset'),
  onStateChanged: (callback: (state: unknown) => void) => {
    const handler = (_event: IpcRendererEvent, state: unknown) => {
      callback(state);
    };
    ipcRenderer.on('login-state-changed', handler);
    return () => {
      ipcRenderer.removeListener('login-state-changed', handler);
    };
  },
});

contextBridge.exposeInMainWorld('shellAPI', {
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
});

contextBridge.exposeInMainWorld('chatAPI', {
  send: (message: string) => ipcRenderer.invoke('chat:send', message),
  abort: () => ipcRenderer.invoke('chat:abort'),
  clear: () => ipcRenderer.invoke('chat:clear'),
  onDelta: (callback: (text: string) => void) => {
    const handler = (_event: IpcRendererEvent, text: string) => {
      callback(text);
    };
    ipcRenderer.on('chat:delta', handler);
    return () => {
      ipcRenderer.removeListener('chat:delta', handler);
    };
  },
  onDone: (callback: () => void) => {
    const handler = () => {
      callback();
    };
    ipcRenderer.on('chat:done', handler);
    return () => {
      ipcRenderer.removeListener('chat:done', handler);
    };
  },
  onError: (callback: (error: string) => void) => {
    const handler = (_event: IpcRendererEvent, error: string) => {
      callback(error);
    };
    ipcRenderer.on('chat:error', handler);
    return () => {
      ipcRenderer.removeListener('chat:error', handler);
    };
  },
});
