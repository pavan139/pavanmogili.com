/**
 * Build config (PERF). The static-HTML plugin renders the classic view; the bundle report
 * feeds the budgets in scripts/postbuild.mjs.
 */
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { bundleReport } from './scripts/bundle-report.mjs';
import * as render from './src/classic/render';

/** Renders src/content.ts into the static HTML (classic view, metadata, 404). */
function staticContent(): Plugin {
  let server: ViteDevServer | undefined;
  const load = async (): Promise<typeof render> =>
    server ? ((await server.ssrLoadModule('/src/classic/render.ts')) as typeof render) : render;
  return {
    name: 'static-content',
    configureServer(s) {
      server = s;
    },
    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        const r = await load();
        return html.replace('<!--@meta-->', r.renderMeta()).replace('<!--@body-->', r.renderBody());
      },
    },
    async generateBundle() {
      const r = await load();
      this.emitFile({ type: 'asset', fileName: '404.html', source: r.render404() });
    },
  };
}

// cross-origin isolation (precise timers); safe: no third-party requests
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  base: './',
  plugins: [staticContent(), bundleReport()],
  build: {
    target: 'es2022',
    // scripts/profile.mjs builds a variant with hidden source maps outside dist/, so it can
    // name the source file of every allocation; deploy builds never carry maps
    outDir: process.env.PERF_OUT || 'dist',
    sourcemap: process.env.PERF_MAPS === '1' ? 'hidden' : false,
    emptyOutDir: true,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 2600,
  },
  server: { host: '127.0.0.1', port: 5174, headers: isolation },
  preview: { host: '127.0.0.1', port: 4174, headers: isolation },
});
