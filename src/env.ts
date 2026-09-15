/**
 * Reads config for the npm-package auto-init path (`@pleaseresolve/sdk/auto`,
 * and `@pleaseresolve/react`'s `<ReportWidget />` when its props are
 * omitted) — the whole point is "install the package, set env vars, done",
 * no `init({ key, ... })` call anywhere in your code.
 *
 * Deliberately **static, literal** `process.env.NEXT_PUBLIC_...` /
 * `process.env.REACT_APP_...` property accesses — not a loop over a list of
 * names, and never read through an intermediate variable. Bundlers that
 * inline env vars at build time (Next.js, Create React App — both via
 * webpack's DefinePlugin under the hood) work by textually matching the
 * exact `process.env.EXACT_NAME` token pattern anywhere it appears in the
 * source, before any dead-code elimination runs; a dynamic lookup, a name
 * built from a variable, or even `const env = process.env; env.FOO` all
 * defeat that and read as `undefined` in the shipped bundle even when the
 * var really is set at build time.
 *
 * The try/catch (not a `typeof process !== "undefined"` guard) is what
 * makes this safe in a context with no bundler substitution at all — a
 * plain, unbundled script tag would throw a `ReferenceError` on bare
 * `process`, which this module has no reason to encounter anyway (it's
 * npm-only; the script-tag build uses `data-*` attributes instead, see
 * auto-init.ts) but degrades to "not configured" rather than a crash if it
 * ever is loaded somewhere unexpected.
 *
 * Vite's `import.meta.env.VITE_...` isn't supported here on purpose:
 * `import.meta` is invalid syntax in this package's CJS build output, and
 * this module ships as both ESM and CJS from the same source. Vite users
 * call `init()` directly instead — one line, using `import.meta.env`
 * themselves; see the package README.
 */
declare const process: { env: Record<string, string | undefined> };

export interface EnvConfig {
  key?: string;
  projectId?: string;
  apiBaseUrl?: string;
}

export function readEnvConfig(): EnvConfig {
  try {
    return {
      key: process.env.NEXT_PUBLIC_PLEASERESOLVE_KEY ?? process.env.REACT_APP_PLEASERESOLVE_KEY,
      projectId:
        process.env.NEXT_PUBLIC_PLEASERESOLVE_PROJECT_ID ??
        process.env.REACT_APP_PLEASERESOLVE_PROJECT_ID,
      apiBaseUrl:
        process.env.NEXT_PUBLIC_PLEASERESOLVE_API_BASE_URL ??
        process.env.REACT_APP_PLEASERESOLVE_API_BASE_URL,
    };
  } catch {
    return {};
  }
}
