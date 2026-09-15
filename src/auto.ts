import { init } from "./index";
import { readEnvConfig } from "./env";

/**
 * Import this once, anywhere in your app's entry point, and the widget
 * mounts itself — no `init({ key, ... })` call needed in your own code:
 *
 *   import "@pleaseresolve/sdk/auto";
 *
 * Configured entirely through environment variables (see env.ts for
 * exactly which names and why only these two prefixes):
 *
 *   NEXT_PUBLIC_PLEASERESOLVE_KEY=pk_live_...
 *   NEXT_PUBLIC_PLEASERESOLVE_PROJECT_ID=...        (optional — only if your key covers more than one project)
 *   NEXT_PUBLIC_PLEASERESOLVE_API_BASE_URL=...      (optional — local/staging testing only)
 *
 * (or the `REACT_APP_...` equivalents for Create React App.)
 *
 * If no key is configured, this logs a warning and does nothing further —
 * safe to include this import speculatively before `.env` is filled in,
 * rather than something that breaks the build.
 */
const env = readEnvConfig();

if (env.key) {
  init({ key: env.key, projectId: env.projectId, apiBaseUrl: env.apiBaseUrl });
} else if (typeof console !== "undefined") {
  console.warn(
    "[@pleaseresolve/sdk] auto-init: no NEXT_PUBLIC_PLEASERESOLVE_KEY (or REACT_APP_PLEASERESOLVE_KEY) found in your environment — set it in your .env, or call init() yourself instead of importing '@pleaseresolve/sdk/auto'.",
  );
}
