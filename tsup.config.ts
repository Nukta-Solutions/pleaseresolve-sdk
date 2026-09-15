import { defineConfig } from "tsup";

export default defineConfig([
  // npm-package builds — Phase 3 (CLIENT_INTEGRATIONS_PLAN.md §6) is what
  // actually publishes these; producing them now costs nothing extra and
  // means Phase 3 doesn't need to touch the build config at all.
  {
    // Two entries in one build so `dist/auto.*` can still `import` from
    // `dist/sdk.*` (shared chunk) instead of duplicating the whole SDK a
    // second time — tsup/esbuild only does that within a single build call.
    entry: { sdk: "src/index.ts", auto: "src/auto.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    platform: "browser",
  },
  // The script-tag build (Phase 2's actual deliverable) — this is the file
  // a CDN serves. Self-contained IIFE, no external deps to fetch
  // separately, global `window.PleaseResolve`.
  {
    entry: { widget: "src/auto-init.ts" },
    format: ["iife"],
    globalName: "PleaseResolve",
    minify: true,
    sourcemap: true,
    platform: "browser",
    outDir: "dist",
  },
]);
