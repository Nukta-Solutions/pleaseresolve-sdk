/**
 * Tracks which reports *this browser* has submitted through the widget, so
 * "View Issues" can show them back — entirely client-side, no backend
 * "list my reports" endpoint exists (see public-report.service.ts). Scoped
 * to `localStorage`, which is already per-origin (one customer site never
 * sees another's), and further namespaced by API key so one page embedding
 * more than one project's widget doesn't mix their histories.
 *
 * Best-effort throughout: a private window, blocked storage, or a full
 * quota should degrade to "View Issues shows nothing tracked yet", never
 * break the widget.
 */

export interface TrackedReport {
  id: string;
  title: string;
  submittedAt: string;
}

const MAX_TRACKED = 50;

function storageKey(apiKey: string): string {
  // First 12 chars of the key is plenty to disambiguate without storing the
  // whole secret in localStorage under an obviously-named key.
  return `pleaseresolve:reports:${apiKey.slice(0, 12)}`;
}

export function trackReport(apiKey: string, report: TrackedReport): void {
  try {
    const existing = getTrackedReports(apiKey);
    const next = [report, ...existing.filter((r) => r.id !== report.id)].slice(
      0,
      MAX_TRACKED,
    );
    localStorage.setItem(storageKey(apiKey), JSON.stringify(next));
  } catch {
    // Storage unavailable — the report was still submitted successfully;
    // it just won't show up in this browser's "View Issues" later.
  }
}

export function getTrackedReports(apiKey: string): TrackedReport[] {
  try {
    const raw = localStorage.getItem(storageKey(apiKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is TrackedReport =>
        !!r && typeof r === "object" && typeof (r as TrackedReport).id === "string",
    );
  } catch {
    return [];
  }
}
