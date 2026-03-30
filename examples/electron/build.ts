import esbuild from 'esbuild';

async function build() {
  await esbuild.build({
    entryPoints: ['main.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outdir: 'dist',
    external: ['electron', '@anthropic-ai/claude-code'],
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
    logLevel: 'info',
    legalComments: 'none',
  });
}

build().catch(() => {
  process.exit(1);
});
