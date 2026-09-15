import type { CapturedContext } from "./types";

/**
 * URL, user agent, viewport — auto-attached to every report with zero
 * configuration. Screenshot capture doesn't exist in this SDK (the
 * built-in form's attachment field, widget.ts, is a manual drag-and-drop
 * upload instead, matching llemr's own report form); console-error capture
 * isn't implemented either — it would need an explicit opt-in, since it can
 * leak a host site's own logged data.
 */
export function captureContext(): CapturedContext {
  return {
    url: window.location.href,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
}
