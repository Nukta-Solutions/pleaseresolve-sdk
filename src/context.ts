import type { CapturedContext } from "./types";

/**
 * Phase 2 scope only (CLIENT_INTEGRATIONS_PLAN.md §4.2): URL, user agent,
 * viewport. Screenshot and console-error capture are Phase 3 — both need
 * more care (a bundled `html2canvas`, an explicit opt-in for console
 * capture since it can leak a host site's own logged data) than belongs in
 * the first cut.
 */
export function captureContext(): CapturedContext {
  return {
    url: window.location.href,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
}
