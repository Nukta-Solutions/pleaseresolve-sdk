export type ReportPriority = "low" | "medium" | "high" | "urgent" | "critical";

export interface Reporter {
  name?: string;
  email?: string;
}

export interface ReportInput {
  title: string;
  description?: string;
  priority?: ReportPriority;
  /** Merged on top of whatever `setMetadata()` has accumulated, per call. */
  metadata?: Record<string, unknown>;
}

export interface InitOptions {
  /** A `public`-type key (`pk_...`) — see CLIENT_INTEGRATIONS_PLAN.md §3.1. Never use a `server` key here; it's readable by anyone who views the page source. */
  key: string;
  /** Omit only if the key is scoped to exactly one project (`ApiKey.allowedProjects`). */
  projectId?: string;
  /** Base API URL, e.g. `https://pleaseresolve-api.nukta.solutions/api/v1`. Override for local/staging testing. */
  apiBaseUrl?: string;
  /** Default `true` — mounts the built-in floating button + form. Set `false` to drive everything from your own UI via `open()`/`report()`. */
  widget?: boolean;
  /**
   * Default `true` — the built-in form captures a screenshot on open (via
   * `html2canvas`) and shows the reporter a preview with a checkbox to
   * include or drop it, checked by default. Has no effect on headless
   * `report()` calls, which never auto-attach a screenshot — only the
   * form does, since only there does the person being screenshotted see
   * and consent to it before it's sent.
   */
  screenshot?: boolean;
}

export interface CapturedContext {
  url: string;
  userAgent: string;
  viewport: string;
}
