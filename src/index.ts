import { captureContext } from "./context";
import { submitReport } from "./api";
import { mountWidget, type WidgetHandle } from "./widget";
import type { InitOptions, ReportInput, Reporter } from "./types";

/**
 * The live backend's own default origin — see
 * pleaseresolve-backend/.env's `BACKEND_URL`. Overridable via
 * `init({ apiBaseUrl })`, mainly for local/staging testing
 * (CLIENT_INTEGRATIONS_PLAN.md flags the CDN/domain naming as still an open
 * decision generally, but the API origin itself is already real).
 */
const DEFAULT_API_BASE_URL = "https://pleaseresolve-api.nukta.solutions/api/v1";

interface SdkState {
  key: string;
  projectId?: string;
  apiBaseUrl: string;
  reporter?: Reporter;
  metadata: Record<string, unknown>;
  widget?: WidgetHandle;
}

let state: SdkState | null = null;

function requireState(): SdkState {
  if (!state) {
    throw new Error("PleaseResolve.init() must be called before using the SDK");
  }
  return state;
}

/**
 * Idempotent by design: a re-run of a host page's own init code (a common
 * SPA pattern on route change) just updates config rather than mounting a
 * second widget on top of the first.
 */
export function init(options: InitOptions): void {
  if (!options?.key) {
    throw new Error("PleaseResolve.init() requires a `key`");
  }

  if (state) {
    state.key = options.key;
    state.projectId = options.projectId;
    state.apiBaseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;
    return;
  }

  state = {
    key: options.key,
    projectId: options.projectId,
    apiBaseUrl: options.apiBaseUrl ?? DEFAULT_API_BASE_URL,
    metadata: {},
  };

  if (options.widget !== false) {
    state.widget = mountWidget({
      onSubmit: (input) => report(input),
      getReporter: () => state?.reporter,
      setReporter: (reporter) => identify(reporter),
    });
  }
}

/** Submits directly — headless mode's programmatic path, and what the built-in form calls internally. */
export async function report(input: ReportInput): Promise<{ id: string }> {
  const s = requireState();
  const context = typeof window !== "undefined" ? captureContext() : undefined;

  return submitReport(s.apiBaseUrl, s.key, {
    ...input,
    projectId: s.projectId,
    reporter: s.reporter,
    context,
    metadata: { ...s.metadata, ...input.metadata },
  });
}

/** Pre-fills the built-in form's name/email fields and attaches this identity to every subsequent `report()` call. */
export function identify(reporter: Reporter): void {
  requireState().reporter = reporter;
}

/** Merged into every report's `metadata` from here on (per-call `metadata` on `report()` still takes precedence on key conflicts). */
export function setMetadata(metadata: Record<string, unknown>): void {
  const s = requireState();
  s.metadata = { ...s.metadata, ...metadata };
}

/** Opens the built-in form overlay — for a custom trigger button when `init({ widget: false })`. No-op if the widget wasn't mounted. */
export function open(): void {
  requireState().widget?.open();
}

/** Closes the built-in form overlay. */
export function close(): void {
  requireState().widget?.close();
}

export type { InitOptions, ReportInput, ReportPriority, Reporter } from "./types";

export const PleaseResolve = { init, report, identify, setMetadata, open, close };
export default PleaseResolve;
