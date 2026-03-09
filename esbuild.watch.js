import * as esbuild from 'esbuild';

const ctx = await esbuild.context({
  entryPoints: ['src/index.ts'],
  bundle: false,
  outdir: 'dist',
  format: 'esm',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  packages: 'external',
});

await ctx.watch();
console.log('Watching for changes...');
