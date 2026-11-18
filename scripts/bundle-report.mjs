/**
 * Vite plugin: writes .build/bundle-report.json (outside dist/, so it never ships) with every
 * chunk (modules, static and dynamic imports, sizes) and every asset (the worker, WASM,
 * images). scripts/postbuild.mjs checks it against tests/budgets.json. Plain JS so the
 * TypeScript check of vite.config.ts needs no Node types.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { brotliCompressSync, constants as zc, gzipSync } from 'node:zlib';

const sizes = (b) => ({
  bytes: typeof b === 'string' ? Buffer.byteLength(b) : b.length,
  gzip: gzipSync(b, { level: 9 }).length,
  brotli: brotliCompressSync(b, { params: { [zc.BROTLI_PARAM_QUALITY]: 9 } }).length,
});

/** @returns {import('vite').Plugin} */
export function bundleReport() {
  const root = process.cwd() + '/';
  return {
    name: 'bundle-report',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = [];
      const assets = [];
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk') {
          chunks.push({
            file: item.fileName,
            isEntry: item.isEntry,
            isDynamicEntry: item.isDynamicEntry,
            facade: item.facadeModuleId ? item.facadeModuleId.replace(root, '') : null,
            modules: Object.keys(item.modules).map((m) => m.replace(root, '')),
            imports: item.imports,
            dynamicImports: item.dynamicImports,
            ...sizes(item.code),
          });
        } else {
          assets.push({ file: item.fileName, ...sizes(typeof item.source === 'string' ? item.source : Buffer.from(item.source)) });
        }
      }
      mkdirSync('.build', { recursive: true });
      writeFileSync('.build/bundle-report.json', JSON.stringify({ chunks, assets }, null, 2));
    },
  };
}
