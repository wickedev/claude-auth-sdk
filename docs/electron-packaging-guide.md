# Packaging Claude Agent SDK in Electron Apps

Lessons learned from building and packaging an Electron app that uses `@anthropic-ai/claude-agent-sdk` with a bundled `@anthropic-ai/claude-code` CLI.

## The Core Challenge

The Agent SDK needs to spawn a Claude Code CLI process. In development this works fine — `node` and `claude` are in PATH. In a packaged Electron app, neither is available.

## Solution: Bundled CLI + Electron Helper Binary

### 1. Bundle `@anthropic-ai/claude-code` as a dependency

```json
{
  "dependencies": {
    "@anthropic-ai/claude-code": "2.1.87"
  }
}
```

The `claude` binary installed via `npm install -g` is a Bun-compiled native binary. You cannot bundle it directly. However, `@anthropic-ai/claude-code` also ships a `cli.js` with a Node.js shebang — the Agent SDK can run `.js` files via a Node.js runtime.

### 2. Unpack from asar

Electron bundles app files into an `app.asar` archive. Executable files inside asar cannot be spawned. Use `asarUnpack` in electron-builder config to extract them:

```json
{
  "build": {
    "files": [
      "dist/**/*",
      "index.html",
      "node_modules/@anthropic-ai/claude-code/**/*"
    ],
    "asarUnpack": [
      "node_modules/@anthropic-ai/claude-code/**/*"
    ]
  }
}
```

### 3. Resolve the unpacked path at runtime

`require.resolve()` returns a path inside `app.asar`, but the actual files are in `app.asar.unpacked`. Replace the path segment:

```ts
function findClaudeCodePath(): string {
  const resolved = require.resolve('@anthropic-ai/claude-code/cli.js');
  return resolved.replace('app.asar', 'app.asar.unpacked');
}
```

### 4. Use `ELECTRON_RUN_AS_NODE` instead of system `node`

A packaged Electron app has no `node` binary in PATH. Electron itself can act as Node.js when `ELECTRON_RUN_AS_NODE=1` is set in the environment. Pass this env var **only to the child process**, never to the main process (it would prevent Electron from starting its GUI).

### 5. Use Electron Helper binary to avoid Dock flash

Spawning `process.execPath` (the main Electron binary) as a child process causes its icon to briefly appear in the macOS Dock. The **Electron Helper** binary (`Contents/Frameworks/<AppName> Helper.app`) has `LSUIElement` set, so it runs without Dock visibility.

```ts
function findHelperExecutable(): string {
  const frameworksPath = path.join(
    path.dirname(app.getPath('exe')), '..', 'Frameworks'
  );
  const appName = path.basename(app.getPath('exe'));
  const helperPath = path.join(
    frameworksPath,
    `${appName} Helper.app`, 'Contents', 'MacOS', `${appName} Helper`
  );
  try {
    require('node:fs').accessSync(helperPath);
    return helperPath;
  } catch {
    return process.execPath; // fallback for dev mode
  }
}
```

### 6. Use `spawnClaudeCodeProcess` for full control

The Agent SDK's `spawnClaudeCodeProcess` option lets you customize how the CLI process is spawned:

```ts
query({
  prompt: userMessage,
  options: {
    pathToClaudeCodeExecutable: findClaudeCodePath(),
    spawnClaudeCodeProcess: ({ args, cwd, env, signal }) => {
      const child = spawn(
        findHelperExecutable(),
        [findClaudeCodePath(), ...args],
        {
          cwd,
          env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
          stdio: ['pipe', 'pipe', 'pipe'],
          signal,
          windowsHide: true,
        }
      );
      return {
        stdin: child.stdin,
        stdout: child.stdout,
        get killed() { return child.killed; },
        get exitCode() { return child.exitCode; },
        kill: (sig) => child.kill(sig),
        on: child.on.bind(child),
        once: child.once.bind(child),
        off: child.off.bind(child),
      };
    },
  },
});
```

## CI/CD: electron-builder in npm Workspaces

### app-builder-bin platform binaries

npm workspace hoisting installs `app-builder-bin` at the root `node_modules` but strips platform-specific binaries. Fix by reinstalling in CI:

```yaml
- name: Reinstall app-builder-bin with platform binaries
  shell: bash
  run: |
    rm -rf node_modules/app-builder-bin
    npm install app-builder-bin
```

### Workspace symlinks

electron-builder cannot follow symlinks outside the project directory. Replace workspace symlinks with copies before building:

```yaml
- name: Replace workspace symlinks with copies
  shell: bash
  run: |
    for pkg in node_modules/@your-scope/pkg-a node_modules/@your-scope/pkg-b; do
      if [ -L "$pkg" ]; then
        target=$(readlink -f "$pkg")
        rm "$pkg"
        cp -r "$target" "$pkg"
      fi
    done
```

### Skip npmRebuild

If your app has no native Node.js modules, disable `npmRebuild` to avoid `@electron/rebuild` failures:

```json
{
  "build": {
    "npmRebuild": false
  }
}
```

### Strip vendor binaries per platform

`@anthropic-ai/claude-code` includes `vendor/ripgrep` and `vendor/audio-capture` binaries for all platforms (~30MB total). Strip non-target platforms in CI to reduce artifact size:

```yaml
- name: Strip vendor binaries for other platforms
  shell: bash
  run: |
    for dir in node_modules/@anthropic-ai/claude-code/vendor/ripgrep \
               node_modules/@anthropic-ai/claude-code/vendor/audio-capture; do
      for sub in "$dir"/*/; do
        name=$(basename "$sub")
        if [ "$name" != "${{ matrix.keep }}" ]; then
          rm -rf "$sub"
        fi
      done
    done
```

### Version from git tag

electron-builder reads version from `package.json`, not git tags. Sync them in CI:

```yaml
- name: Set version from git tag
  run: |
    VERSION="${GITHUB_REF_NAME#v}"
    cd examples/electron
    npm version "$VERSION" --no-git-tag-version
```

## esbuild Configuration

### Mark `@anthropic-ai/claude-code` as external

Since `cli.js` is resolved at runtime via `require.resolve()`, it must not be bundled:

```ts
await esbuild.build({
  external: ['electron', '@anthropic-ai/claude-code'],
});
```

### Strip license comments

Bundled dependencies include license comments that may be visible in the app. Remove them:

```ts
await esbuild.build({
  legalComments: 'none',
});
```

## Summary

| Problem | Solution |
| --- | --- |
| `cli.js` inside asar can't be executed | `asarUnpack` + path replacement |
| No `node` in PATH in packaged app | `ELECTRON_RUN_AS_NODE=1` on child process |
| Dock icon flashes on macOS | Use Electron Helper binary instead of main binary |
| `app-builder-bin` missing binaries in CI | Delete and reinstall in CI |
| Workspace symlinks break electron-builder | Replace symlinks with copies |
| 30MB of unused platform binaries | Strip non-target vendor binaries per arch |
