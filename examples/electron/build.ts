import path from 'node:path';
import esbuild from 'esbuild';

const repoRoot = path.resolve(process.cwd(), '..', '..');
const localWorkspaceAliases = {
  '@claude-auth-sdk/core': path.join(repoRoot, 'packages/core/src/index.ts'),
  '@claude-auth-sdk/react': path.join(repoRoot, 'packages/react/src/index.ts'),
};

async function build() {
  await esbuild.build({
    entryPoints: ['main.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outdir: 'dist',
    external: ['electron', '@anthropic-ai/claude-code'],
    alias: localWorkspaceAliases,
    logLevel: 'info',
    legalComments: 'none',
  });

  await esbuild.build({
    entryPoints: ['preload.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outdir: 'dist',
    external: ['electron'],
    alias: localWorkspaceAliases,
    logLevel: 'info',
    legalComments: 'none',
  });

  await esbuild.build({
    entryPoints: ['src/index.tsx'],
    bundle: true,
    platform: 'browser',
    target: 'chrome120',
    format: 'iife',
    outfile: 'dist/renderer.js',
    jsx: 'automatic',
    alias: localWorkspaceAliases,
    logLevel: 'info',
    legalComments: 'none',
  });
}

build().catch(() => {
  process.exit(1);
});
