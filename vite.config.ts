// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { unwasm } from "unwasm/plugin";

import { VitePWA } from "vite-plugin-pwa";

const nitroPreset = process.env["NITRO_PRESET"] ?? "cloudflare-module";
const wasmAsModule = nitroPreset === "cloudflare-module";
const cloudflareWasmPlugin = {
  ...unwasm({ esmImport: true }),
  name: "unwasm-cloudflare-ssr",
  applyToEnvironment: (environment: { name: string; config: { command: string } }) =>
    environment.name === "ssr" && environment.config.command === "build" && wasmAsModule,
};
const nodeWasmPlugin = {
  ...unwasm({ esmImport: false }),
  name: "unwasm-node-ssr",
  applyToEnvironment: (environment: { name: string; config: { command: string } }) =>
    environment.name === "ssr" && (environment.config.command === "serve" || !wasmAsModule),
};
const wasmModuleSuffixPlugin = {
  name: "og-wasm-module-imports",
  applyToEnvironment: (environment: { name: string; config: { command: string } }) =>
    environment.name === "ssr" && environment.config.command === "build" && wasmAsModule,
  renderChunk(code: string) {
    // Cloudflare's CompiledWasm rule turns these emitted .wasm imports into WebAssembly.Module values.
    return code.replace(/(["'])(\.\.\/wasm\/[^"']+\.wasm)(["'])/g, "$1$2?module$3");
  },
};

export default defineConfig({
  nitro: { preset: nitroPreset },
  vite: { plugins: [cloudflareWasmPlugin, nodeWasmPlugin, wasmModuleSuffixPlugin, VitePWA({strategies: "generateSW", filename: "sw.js", registerType: "autoUpdate", injectRegister: null, manifest: false, devOptions: {enabled: false}, workbox: {globPatterns: ["**/*.{js,css,png,woff2}"], navigateFallback: null, cleanupOutdatedCaches: true, runtimeCaching: [{urlPattern: ({request,url}) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth") && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/admin"), handler: "NetworkFirst", options: {cacheName: "lezgo-navigation", networkTimeoutSeconds: 5, expiration: {maxEntries: 20, maxAgeSeconds: 86400}}}, {urlPattern: ({url}) => url.origin === self.location.origin && /\/assets\/.*[.-][a-zA-Z0-9_-]{8,}\.(js|css|woff2|png)$/.test(url.pathname), handler: "CacheFirst", options: {cacheName: "lezgo-assets", expiration: {maxEntries: 100, maxAgeSeconds: 2592000}}}]}})] },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
