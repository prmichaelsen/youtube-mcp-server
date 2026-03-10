import * as esbuild from 'esbuild';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

function findTsFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...findTsFiles(full));
    } else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

const ctx = await esbuild.context({
  entryPoints: findTsFiles('src'),
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
