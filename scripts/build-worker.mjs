// Bundles worker/index.js (+ server/core.mjs, server/users.js) into dist/_worker.js
// so the dist/ folder is a complete, self-contained Cloudflare Pages deployment.
import { build } from 'esbuild'

await build({
  entryPoints: ['worker/index.js'],
  outfile: 'dist/_worker.js',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
})
console.log('Bundled dist/_worker.js')
