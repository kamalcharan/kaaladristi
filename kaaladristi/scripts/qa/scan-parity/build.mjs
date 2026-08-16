/**
 * Bundles the REAL src/services/scanEngine.ts for Node so the parity run
 * executes production logic with zero transcription drift.
 *
 * How: copy scanEngine.ts to a scratch file, append one export block for the
 * internals the runner needs (SCAN_FUNCTIONS / loadScanData / helpers), then
 * esbuild-bundle it with './postgrest' aliased to postgrest-shim.mjs.
 * TypeScript `import type` lines are elided by esbuild, so the shim is the
 * only runtime dependency.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

// The frontend's own esbuild (Vite dependency) — ESM ignores NODE_PATH, so
// import it by path rather than requiring a package.json in this directory.
const { build } = await import(
  path.join(repoRoot, 'App/frontend/node_modules/esbuild/lib/main.js')
);
const src = path.join(repoRoot, 'App/frontend/src/services/scanEngine.ts');
const scratch = path.join(here, '.build');
mkdirSync(scratch, { recursive: true });

const EXPORT_BLOCK = `
// ── appended by scripts/qa/scan-parity/build.mjs (parity harness only) ──
export { SCAN_FUNCTIONS as __SCAN_FUNCTIONS, loadScanData as __loadScanData,
         deduplicateByIsin as __deduplicateByIsin };
`;

const copyPath = path.join(scratch, 'scanEngine.parity.ts');
writeFileSync(copyPath, readFileSync(src, 'utf8') + EXPORT_BLOCK);

const shimPath = path.join(here, 'postgrest-shim.mjs');

await build({
  entryPoints: [copyPath],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile: path.join(scratch, 'scanEngine.bundle.mjs'),
  define: { 'import.meta.env': '{}' },
  external: ['./mcp-sql.mjs'],
  plugins: [
    {
      name: 'alias-postgrest',
      setup(b) {
        b.onResolve({ filter: /^\.\/postgrest$/ }, () => ({ path: shimPath, external: true }));
      },
    },
  ],
  logLevel: 'warning',
});

console.log('built', path.join(scratch, 'scanEngine.bundle.mjs'));
