import type { ReportInput, ReportPriority } from "./types";
import type { ReportStatusSummary } from "./api";

export interface WidgetHandlers {
  onSubmit: (input: ReportInput, attachments: File[]) => Promise<{ id: string }>;
  /** Every report for the project, not scoped to this browser — see api.ts's `listReports`. */
  listReports: () => Promise<ReportStatusSummary[]>;
}

export interface WidgetHandle {
  open: () => void;
  close: () => void;
  destroy: () => void;
}

// Matches llemr's own GlobalReportDropdown exactly — Low/Medium/High only,
// no Urgent/Critical (the widget's UI intentionally mirrors that form 1:1;
// see this file's top-level doc comment).
const PRIORITIES: { value: ReportPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

/**
 * Maps the backend's `ReportStatus` (report.constants.ts) to a label + the
 * matching llemr badge tone (llemr's own status set is New/In Progress/On
 * Hold/Resolved — this SDK's is new/in_progress/resolved/blocked/closed;
 * `blocked` reuses "warning" the same conceptual role as llemr's On Hold,
 * `closed` has no llemr equivalent so it gets a neutral tone instead of
 * inventing a color llemr doesn't use).
 */
const STATUS_META: Record<string, { label: string; tone: string }> = {
  new: { label: "New", tone: "pr-badge-destructive" },
  in_progress: { label: "In Progress", tone: "pr-badge-primary" },
  resolved: { label: "Resolved", tone: "pr-badge-resolved" },
  blocked: { label: "Blocked", tone: "pr-badge-warning" },
  closed: { label: "Closed", tone: "pr-badge-neutral" },
};

/** Same three tones llemr's own PriorityBadge uses for High/Medium/Low. */
const PRIORITY_META: Record<string, { label: string; tone: string }> = {
  high: { label: "High", tone: "pr-badge-destructive" },
  medium: { label: "Medium", tone: "pr-badge-warning" },
  low: { label: "Low", tone: "pr-badge-primary" },
};

const SUPPORT_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="1" y="2" width="14" height="2.4" rx="1.2" fill="currentColor"/>
  <rect x="1" y="6.8" width="14" height="2.4" rx="1.2" fill="currentColor"/>
  <rect x="1" y="11.6" width="8.5" height="2.4" rx="1.2" fill="currentColor"/>
</svg>`;

const PLUS_ICON = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M7.5 1.5V13.5M1.5 7.5H13.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

// This icon and the other lucide-sourced ones below (PERSON_ICON,
// FOLDER_ICON, CLOCK_ICON, CLOSE_X_ICON below) use lucide-react's
// actual path data, pulled directly from llemr's own rendered DOM — not
// hand-drawn approximations — since llemr's own UI uses lucide-react
// throughout. lucide-react is ISC-licensed; embedding its path data as
// inline SVG doesn't pull in the library itself.
const EYE_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
  <circle cx="12" cy="12" r="3"/>
</svg>`;

const UPLOAD_ICON = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M10 13V3M10 3L6 7M10 3L14 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3 13V15.5C3 16.3284 3.67157 17 4.5 17H15.5C16.3284 17 17 16.3284 17 15.5V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

const X_ICON = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

// Real lucide "x" path (used by the detail modal's close button, matching
// llemr's exact icon+circular-grey-button chrome rather than a plain "×").
const CLOSE_X_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18 6 6 18"/>
  <path d="m6 6 12 12"/>
</svg>`;

const SEARCH_ICON = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="7" cy="7" r="5.25" stroke="currentColor" stroke-width="1.4"/>
  <path d="M14 14L11 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

const ISSUES_ICON = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="3.5" y="2.5" width="13" height="15" rx="2" stroke="currentColor" stroke-width="1.4"/>
  <path d="M7 6.5H13M7 10H13M7 13.5H10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

const REFRESH_ICON = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3.2h-3.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const PERSON_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
  <circle cx="12" cy="7" r="4"/>
</svg>`;

const CLOCK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 6v6l4 2"/>
  <circle cx="12" cy="12" r="10"/>
</svg>`;

const FOLDER_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>
</svg>`;

const FILE_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 1.5h5l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
  <path d="M9 1.5V4.5H12" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
</svg>`;

const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

.pr-trigger {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 999999;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border: none;
  border-radius: 999px;
  background: #6366f1;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
}
.pr-trigger:hover { background: #4f46e5; }
.pr-trigger[hidden] { display: none; }

.pr-menu {
  position: fixed;
  right: 20px;
  bottom: 76px;
  z-index: 999999;
  width: 200px;
  background: #fff;
  border-radius: 20px;
  padding: 10px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
}
.pr-menu[hidden] { display: none; }
.pr-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  border-radius: 12px;
  font-size: 14px;
  color: #1f2937;
  cursor: pointer;
  text-align: left;
}
.pr-menu-item:hover { background: #f3f4f6; }
.pr-menu-item svg { color: #6366f1; flex-shrink: 0; }

.pr-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000000;
  background: rgba(15, 15, 20, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.pr-overlay[hidden] { display: none; }

.pr-panel {
  width: 100%;
  max-width: 640px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
/* The Issues table has more columns than the New Issue form has fields
   (Reported/Report Title/Submitted by/Priority/Status/Due Date/Action,
   matching llemr's real admin/reports page exactly) — needs real room. */
.pr-panel-wide { max-width: 960px; }
.pr-title { margin: 0 0 4px; font-size: 18px; font-weight: 600; color: #0f172a; }
.pr-subtitle { margin: 0 0 16px; font-size: 13px; color: #6b7280; }
.pr-form-divider { border-top: 1px solid #e2e8f0; margin-top: 16px; padding-top: 16px; }
.pr-field { margin-bottom: 14px; }
.pr-label {
  display: block;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #64748b;
}
.pr-input, .pr-textarea, .pr-select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #111827;
  background: #fff;
}
.pr-input::placeholder, .pr-textarea::placeholder { color: #94a3b8; }
.pr-input:focus, .pr-textarea:focus, .pr-select:focus {
  outline: 2px solid #6366f1;
  outline-offset: 1px;
  border-color: #6366f1;
}
.pr-textarea { min-height: 96px; resize: vertical; }
.pr-select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 30px;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%2364748b' stroke-width='1.6'%3E%3Cpath d='M6 8l4 4 4-4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 16px;
}
.pr-row { display: flex; gap: 8px; }
.pr-row > .pr-field { flex: 1; }
.pr-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.pr-btn {
  padding: 8px 18px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}
.pr-btn-primary { background: #6366f1; color: #fff; }
.pr-btn-primary:hover { background: #4f46e5; }
.pr-btn-primary:disabled { background: #a5a6f6; cursor: not-allowed; }
.pr-btn-secondary { background: #fff; color: #374151; border-color: #d1d5db; }
.pr-btn-secondary:hover { background: #f9fafb; }
.pr-error {
  margin-bottom: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 13px;
}
.pr-success { text-align: center; padding: 16px 0; }
.pr-success-title { font-size: 15px; font-weight: 700; color: #111827; margin: 0 0 4px; }
.pr-success-body { font-size: 13px; color: #6b7280; margin: 0; }
/* Matches llemr's real close button exactly: a circular grey chip with an
   icon inside, not a plain "×" glyph — see this file's CLOSE_X_ICON. */
.pr-close {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 999px;
  background: #d1d5db;
  color: #1f2937;
  opacity: 0.7;
  cursor: pointer;
  transition: opacity 0.15s;
}
.pr-close:hover { opacity: 1; }
/* Screen-reader-only text — matches llemr's own close button having both
   an aria-label AND a visually-hidden text node. */
.pr-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.pr-required { color: #ef4444; }

.pr-dropzone {
  cursor: pointer;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  padding: 16px;
  transition: border-color 0.15s, background 0.15s;
}
.pr-dropzone:hover, .pr-dropzone.pr-dropzone-active {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.05);
}
.pr-dropzone-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 13px;
}
.pr-dropzone input[type="file"] { display: none; }

.pr-file-list {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  max-height: 128px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
}
.pr-file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
}
.pr-file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pr-file-remove {
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  padding: 2px;
  flex-shrink: 0;
}
.pr-file-remove:hover { color: #ef4444; }

/* "Issues" toolbar + table — matches llemr's real admin/reports page
   (ReportList.tsx/ReportBadges.tsx) exactly, including its badge colors
   (converted from that app's own oklch() design tokens). No Submitted-by,
   Due Date, or Action/View-details columns — this widget's public read API
   deliberately never returns that data (see public-report.service.ts's
   getById), so there'd be nothing real to put in them. */
.pr-issues-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 14px;
}
.pr-search-wrap { position: relative; flex-shrink: 0; }
.pr-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  pointer-events: none;
}
.pr-search-input {
  height: 36px;
  width: 200px;
  padding: 0 10px 0 32px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  color: #111827;
  background: #fff;
}
.pr-search-input:focus { outline: 2px solid #6366f1; outline-offset: 1px; border-color: #6366f1; }
.pr-btn-sm {
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.pr-btn-sm-outline { background: #fff; color: #374151; border: 1px solid #d1d5db; }
.pr-btn-sm-outline:hover { background: #f9fafb; }
.pr-btn-sm-primary { background: #6366f1; color: #fff; border: 1px solid transparent; }
.pr-btn-sm-primary:hover { background: #4f46e5; }

.pr-table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
.pr-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.pr-table thead th {
  background: #f8fafc;
  text-align: left;
  padding: 10px 12px;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
  border-bottom: 1px solid #e2e8f0;
}
.pr-table tbody td {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
  vertical-align: middle;
}
.pr-table tbody tr:last-child td { border-bottom: none; }
.pr-table-title {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: #1e293b;
}

/* soft badges — variant="soft" color={destructive|warning|primary} from
   llemr's Badge component, at the library's own bg-color/20 opacity. */
.pr-badge {
  flex-shrink: 0;
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 999px;
  white-space: nowrap;
}
.pr-badge-destructive { background: rgba(231, 0, 11, 0.16); color: #e7000b; }
.pr-badge-warning { background: rgba(240, 15, 105, 0.16); color: #f00f69; }
.pr-badge-primary { background: rgba(155, 95, 151, 0.16); color: #9b5f97; }
.pr-badge-resolved { background: #ede9fe; color: #6d28d9; }
.pr-badge-neutral { background: #f1f5f9; color: #64748b; }

/* Action column's View button — llemr's own is an outline pill in its
   accent color (border-primary-bright text-primary rounded-[50px]). */
.pr-btn-view {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid #6366f1;
  background: transparent;
  color: #6366f1;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.pr-btn-view:hover { background: rgba(99, 102, 241, 0.08); }

/* Report detail modal — matches llemr's real ReportDetailModal.tsx. */
.pr-detail-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}
.pr-detail-info-item { display: flex; align-items: center; gap: 8px; min-width: 0; }
.pr-detail-info-item span:not(.pr-badge) {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pr-detail-info-item svg { width: 16px; height: 16px; color: #64748b; flex-shrink: 0; }
.pr-detail-section { margin-bottom: 20px; }
.pr-detail-section:last-child { margin-bottom: 0; }
.pr-detail-section-label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #64748b;
}
.pr-detail-section-body { font-size: 14px; color: #1e293b; line-height: 1.6; margin: 0; white-space: pre-wrap; }
.pr-detail-section-empty { font-size: 14px; color: #94a3b8; margin: 0; }

.pr-attachment-list { display: flex; flex-wrap: wrap; gap: 8px; }
/* Sized and behaved exactly like llemr's real thumbnail (h-28 w-28,
   rounded-lg, hover overlay + eye icon) — see this file's EYE_ICON. */
.pr-attachment-image {
  position: relative;
  display: block;
  width: 112px;
  height: 112px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  background: #f9fafb;
  cursor: pointer;
}
.pr-attachment-image:hover { border-color: #6366f1; }
.pr-attachment-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pr-attachment-image-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0);
  color: #fff;
  opacity: 0;
  transition: background 0.15s, opacity 0.15s;
}
.pr-attachment-image:hover .pr-attachment-image-overlay { background: rgba(0, 0, 0, 0.4); opacity: 1; }
.pr-attachment-image-overlay svg { width: 20px; height: 20px; }
.pr-attachment-file {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 220px;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  text-decoration: none;
  cursor: pointer;
}
.pr-attachment-file:hover { background: #f9fafb; border-color: #6366f1; }
.pr-attachment-file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
  flex-shrink: 0;
}
.pr-attachment-file-name {
  font-size: 12px;
  font-weight: 500;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pr-empty { padding: 24px 0; text-align: center; font-size: 13px; color: #9ca3af; }
`;

/**
 * The default UI, per CLIENT_INTEGRATIONS_PLAN.md §4.1 — this is what
 * `PleaseResolve.init({ widget: true })` (the default) mounts. Built in a
 * Shadow DOM so it neither inherits the host page's CSS nor leaks its own
 * styles onto it — a real concern for anything embedded on someone else's
 * site.
 *
 * UI pattern (trigger → small menu → New Issue / View Issues) matches the
 * internal "GlobalReportDropdown" widget already shipping on llemr —
 * intentionally, so the two products feel like one family. One deliberate
 * difference: llemr's "View Issues" is a full page (it owns its whole app,
 * with real routes to send someone to); this widget is dropped into an
 * arbitrary third-party page that has no such route, so "View Issues" here
 * is a popup instead.
 */
export function mountWidget(handlers: WidgetHandlers): WidgetHandle {
  const host = document.createElement("div");
  host.setAttribute("data-pleaseresolve-widget", "");
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = STYLES;
  root.appendChild(style);

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "pr-trigger";
  trigger.innerHTML = `${SUPPORT_ICON}<span>Support</span>`;
  trigger.setAttribute("aria-label", "Support");
  trigger.setAttribute("aria-haspopup", "true");
  root.appendChild(trigger);

  const menu = document.createElement("div");
  menu.className = "pr-menu";
  menu.hidden = true;
  menu.setAttribute("role", "menu");
  root.appendChild(menu);

  const newIssueItem = document.createElement("button");
  newIssueItem.type = "button";
  newIssueItem.className = "pr-menu-item";
  newIssueItem.setAttribute("role", "menuitem");
  newIssueItem.innerHTML = `${PLUS_ICON}<span>New Issue</span>`;
  menu.appendChild(newIssueItem);

  const viewIssuesItem = document.createElement("button");
  viewIssuesItem.type = "button";
  viewIssuesItem.className = "pr-menu-item";
  viewIssuesItem.setAttribute("role", "menuitem");
  viewIssuesItem.innerHTML = `${EYE_ICON}<span>View Issues</span>`;
  menu.appendChild(viewIssuesItem);

  const overlay = document.createElement("div");
  overlay.className = "pr-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  root.appendChild(overlay);

  const panel = document.createElement("div");
  panel.className = "pr-panel";
  panel.style.position = "relative";
  overlay.appendChild(panel);

  const issuesOverlay = document.createElement("div");
  issuesOverlay.className = "pr-overlay";
  issuesOverlay.hidden = true;
  issuesOverlay.setAttribute("role", "dialog");
  issuesOverlay.setAttribute("aria-modal", "true");
  root.appendChild(issuesOverlay);

  const issuesPanel = document.createElement("div");
  issuesPanel.className = "pr-panel";
  issuesPanel.style.position = "relative";
  issuesOverlay.appendChild(issuesPanel);

  // A third overlay, stacked on top of the other two — the Action column's
  // "View" button (openDetail below) opens this over the Issues table
  // rather than replacing it, matching llemr's own ReportDetailModal
  // opening over its Issues table the same way.
  const detailOverlay = document.createElement("div");
  detailOverlay.className = "pr-overlay";
  detailOverlay.hidden = true;
  detailOverlay.setAttribute("role", "dialog");
  detailOverlay.setAttribute("aria-modal", "true");
  detailOverlay.style.zIndex = "1000001";
  root.appendChild(detailOverlay);

  const detailPanel = document.createElement("div");
  detailPanel.className = "pr-panel pr-panel-wide";
  detailPanel.style.position = "relative";
  detailOverlay.appendChild(detailPanel);

  let attachedFiles: File[] = [];

  function closeMenu() {
    menu.hidden = true;
  }

  function toggleMenu() {
    menu.hidden = !menu.hidden;
  }

  function render() {
    panel.innerHTML = "";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "pr-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = CLOSE_X_ICON + '<span class="pr-sr-only">Close</span>';
    closeBtn.addEventListener("click", close);
    panel.appendChild(closeBtn);

    const title = document.createElement("h2");
    title.className = "pr-title";
    title.textContent = "Create New Issue";
    panel.appendChild(title);

    const form = document.createElement("form");
    form.className = "pr-form-divider";
    panel.appendChild(form);

    const errorBox = document.createElement("div");
    errorBox.className = "pr-error";
    errorBox.hidden = true;
    form.appendChild(errorBox);

    const titleField = fieldInput("title", "Issue Title", "input", true);
    (titleField.el as HTMLInputElement).placeholder = "Enter report title";
    const descField = fieldInput("description", "Description", "textarea", false);
    (descField.el as HTMLTextAreaElement).placeholder = "Describe the issue or report details...";
    form.appendChild(titleField.wrapper);
    form.appendChild(descField.wrapper);

    const priorityField = fieldSelect();
    form.appendChild(priorityField.wrapper);

    form.appendChild(buildAttachmentField());

    const actions = document.createElement("div");
    actions.className = "pr-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "pr-btn pr-btn-secondary";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", close);
    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "pr-btn pr-btn-primary";
    submitBtn.textContent = "Create Report";
    actions.appendChild(cancelBtn);
    actions.appendChild(submitBtn);
    form.appendChild(actions);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const titleValue = (titleField.el as HTMLInputElement).value.trim();
      errorBox.hidden = true;
      if (!titleValue) {
        errorBox.textContent = "Please describe what happened.";
        errorBox.hidden = false;
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting…";

      handlers
        .onSubmit(
          {
            title: titleValue,
            description:
              (descField.el as HTMLTextAreaElement).value.trim() || undefined,
            priority: (priorityField.el as HTMLSelectElement).value as ReportPriority,
          },
          attachedFiles,
        )
        .then(() => {
          renderSuccess();
        })
        .catch((err: unknown) => {
          submitBtn.disabled = false;
          submitBtn.textContent = "Create Report";
          errorBox.textContent =
            err instanceof Error
              ? err.message
              : "Something went wrong. Please try again.";
          errorBox.hidden = false;
        });
    });

    // First interactive control — matches the plan's "zero-friction" pitch;
    // a reporter should be able to just start typing.
    (titleField.el as HTMLInputElement).focus();
  }

  function renderSuccess() {
    panel.innerHTML = "";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "pr-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = CLOSE_X_ICON + '<span class="pr-sr-only">Close</span>';
    closeBtn.addEventListener("click", close);
    panel.appendChild(closeBtn);

    const wrap = document.createElement("div");
    wrap.className = "pr-success";
    const heading = document.createElement("p");
    heading.className = "pr-success-title";
    heading.textContent = "Thanks — we've got it.";
    const body = document.createElement("p");
    body.className = "pr-success-body";
    body.textContent = "Your report was submitted successfully.";
    wrap.appendChild(heading);
    wrap.appendChild(body);
    panel.appendChild(wrap);

    window.setTimeout(close, 2500);
  }

  function fieldInput(
    name: string,
    label: string,
    tag: "input" | "textarea",
    required: boolean,
  ): { wrapper: HTMLElement; el: HTMLInputElement | HTMLTextAreaElement } {
    const wrapper = document.createElement("div");
    wrapper.className = "pr-field";
    const labelEl = document.createElement("label");
    labelEl.className = "pr-label";
    labelEl.textContent = label;
    if (required) {
      const asterisk = document.createElement("span");
      asterisk.className = "pr-required";
      asterisk.textContent = " *";
      labelEl.appendChild(asterisk);
    }
    const id = `pr-${name}-${Math.random().toString(36).slice(2, 8)}`;
    labelEl.setAttribute("for", id);
    const el = document.createElement(tag);
    el.id = id;
    el.className = tag === "input" ? "pr-input" : "pr-textarea";
    if (required) el.setAttribute("required", "");
    wrapper.appendChild(labelEl);
    wrapper.appendChild(el);
    return { wrapper, el: el as HTMLInputElement | HTMLTextAreaElement };
  }

  function fieldSelect(): { wrapper: HTMLElement; el: HTMLSelectElement } {
    const wrapper = document.createElement("div");
    wrapper.className = "pr-field";
    const labelEl = document.createElement("label");
    labelEl.className = "pr-label";
    labelEl.textContent = "Priority";
    const id = `pr-priority-${Math.random().toString(36).slice(2, 8)}`;
    labelEl.setAttribute("for", id);
    const el = document.createElement("select");
    el.id = id;
    el.className = "pr-select";
    for (const p of PRIORITIES) {
      const opt = document.createElement("option");
      opt.value = p.value;
      opt.textContent = p.label;
      if (p.value === "medium") opt.selected = true;
      el.appendChild(opt);
    }
    wrapper.appendChild(labelEl);
    wrapper.appendChild(el);
    return { wrapper, el };
  }

  /**
   * A real drag-and-drop/click-to-browse multi-file attachment field —
   * matches llemr's `GlobalReportDropdown` attachment UI exactly (this
   * widget's whole form is a deliberate 1:1 visual clone of it, see this
   * file's top-level doc comment). Replaces the auto-captured-screenshot
   * consent flow an earlier version of this widget had: this widget has no
   * way to know what the reporter's page looks like without asking for a
   * manual attachment, same as llemr's own form never captures one either.
   */
  function buildAttachmentField(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "pr-field";

    const label = document.createElement("label");
    label.className = "pr-label";
    label.textContent = "Attachment (Optional)";
    wrapper.appendChild(label);

    const dropzone = document.createElement("div");
    dropzone.className = "pr-dropzone";
    const inner = document.createElement("div");
    inner.className = "pr-dropzone-inner";
    inner.innerHTML = `${UPLOAD_ICON}<span>Drop files here or click to browse</span>`;
    dropzone.appendChild(inner);

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    dropzone.appendChild(fileInput);
    wrapper.appendChild(dropzone);

    const list = document.createElement("ul");
    list.className = "pr-file-list";
    list.hidden = true;
    wrapper.appendChild(list);

    function renderFileList() {
      list.innerHTML = "";
      list.hidden = attachedFiles.length === 0;
      attachedFiles.forEach((file, index) => {
        const item = document.createElement("li");
        item.className = "pr-file-item";
        const name = document.createElement("span");
        name.className = "pr-file-name";
        name.textContent = file.name;
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "pr-file-remove";
        removeBtn.innerHTML = X_ICON;
        removeBtn.setAttribute("aria-label", `Remove ${file.name}`);
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          attachedFiles = attachedFiles.filter((_, i) => i !== index);
          renderFileList();
        });
        item.appendChild(name);
        item.appendChild(removeBtn);
        list.appendChild(item);
      });
    }

    function addFiles(files: FileList | null) {
      if (!files || files.length === 0) return;
      attachedFiles = [...attachedFiles, ...Array.from(files)];
      renderFileList();
    }

    dropzone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      addFiles(fileInput.files);
      fileInput.value = "";
    });
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("pr-dropzone-active");
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("pr-dropzone-active");
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("pr-dropzone-active");
      addFiles(e.dataTransfer?.files ?? null);
    });

    renderFileList();
    return wrapper;
  }

  function open() {
    closeMenu();
    overlay.hidden = false;
    attachedFiles = [];
    render();
  }

  function close() {
    overlay.hidden = true;
    issuesOverlay.hidden = true;
    detailOverlay.hidden = true;
  }

  /** Matches llemr's own ReportList.tsx `formatDateTime` exactly (same toLocaleString options). */
  function formatDateTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * "View Issues" — a popup here, not a page navigation like llemr's
   * equivalent, since this widget has no page of its own on the host site
   * to send anyone to (see this file's top-level doc comment). A 1:1 clone
   * of llemr's real admin/reports "Issues" table (ReportList.tsx/
   * ReportBadges.tsx) — same toolbar, table, and badge colors, including
   * the same data scope: every report for the project, not just what this
   * browser submitted (see handlers.listReports and
   * public-report.service.ts's class-level doc comment for the trade-off
   * that represents and why it was accepted — a public key is readable
   * from the page's own source, so this is genuinely visible to anyone who
   * can read that page, not just the reporter).
   */
  async function openIssues() {
    closeMenu();
    issuesOverlay.hidden = false;
    issuesPanel.innerHTML = "";
    issuesPanel.classList.add("pr-panel-wide");

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "pr-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = CLOSE_X_ICON + '<span class="pr-sr-only">Close</span>';
    closeBtn.addEventListener("click", close);
    issuesPanel.appendChild(closeBtn);

    const header = document.createElement("div");
    header.className = "pr-issues-toolbar";
    header.style.justifyContent = "space-between";
    header.style.paddingRight = "28px"; // clears the absolutely-positioned .pr-close button
    issuesPanel.appendChild(header);

    const titleWrap = document.createElement("div");
    titleWrap.style.display = "flex";
    titleWrap.style.alignItems = "center";
    titleWrap.style.gap = "8px";
    titleWrap.innerHTML = `<span style="color:#475569;display:flex">${ISSUES_ICON}</span>`;
    const titleEl = document.createElement("h2");
    titleEl.className = "pr-title";
    titleEl.style.margin = "0";
    titleEl.textContent = "Issues";
    titleWrap.appendChild(titleEl);
    header.appendChild(titleWrap);

    const toolbar = document.createElement("div");
    toolbar.className = "pr-issues-toolbar";
    toolbar.style.margin = "0";

    const searchWrap = document.createElement("div");
    searchWrap.className = "pr-search-wrap";
    searchWrap.innerHTML = `<span class="pr-search-icon">${SEARCH_ICON}</span>`;
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "pr-search-input";
    searchInput.placeholder = "Search issues";
    searchWrap.appendChild(searchInput);
    toolbar.appendChild(searchWrap);

    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "pr-btn-sm pr-btn-sm-outline";
    refreshBtn.innerHTML = `${REFRESH_ICON}<span>Refresh</span>`;
    toolbar.appendChild(refreshBtn);

    const newIssueBtn = document.createElement("button");
    newIssueBtn.type = "button";
    newIssueBtn.className = "pr-btn-sm pr-btn-sm-primary";
    newIssueBtn.innerHTML = `${PLUS_ICON}<span>New Issue</span>`;
    newIssueBtn.addEventListener("click", () => {
      close();
      open();
    });
    toolbar.appendChild(newIssueBtn);

    header.appendChild(toolbar);

    const tableWrap = document.createElement("div");
    tableWrap.className = "pr-table-wrap";
    issuesPanel.appendChild(tableWrap);

    const table = document.createElement("table");
    table.className = "pr-table";
    tableWrap.appendChild(table);

    const thead = document.createElement("thead");
    thead.innerHTML =
      "<tr><th>Reported</th><th>Report Title</th><th>Submitted by</th><th>Priority</th><th>Status</th><th>Due Date</th><th>Action</th></tr>";
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    table.appendChild(tbody);

    type Row = ReportStatusSummary;
    let rows: Row[] = [];
    let query = "";

    function badgeHtml(meta: Record<string, { label: string; tone: string }>, key: string | undefined): string {
      // Falls back to a plain neutral badge for values llemr's own UI has no
      // tier for at all (report()'s ReportPriority allows "urgent"/
      // "critical", beyond the form's Low/Medium/High) — still shown, just
      // title-cased rather than the raw lowercase API value.
      const fallbackLabel = key ? key.charAt(0).toUpperCase() + key.slice(1) : "—";
      const m = key ? (meta[key] ?? { label: fallbackLabel, tone: "pr-badge-neutral" }) : { label: "—", tone: "pr-badge-neutral" };
      return `<span class="pr-badge ${m.tone}">${m.label}</span>`;
    }

    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

    /**
     * The Action column's "View" button — a real modal (not an inline
     * expand), matching llemr's ReportDetailModal.tsx: title, priority
     * badge under a divider, a 2x2 info grid, then a Description section.
     * No Attachments section — this widget's public read API never returns
     * attachment data at all (a bigger, deliberate exposure boundary than
     * the description/reporterName/dueDate already added; see
     * public-report.service.ts's getById doc comment), so there's nothing
     * real to show there.
     */
    function openDetail(row: Row) {
      detailPanel.innerHTML = "";
      detailOverlay.hidden = false;

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "pr-close";
      closeBtn.setAttribute("aria-label", "Close");
      closeBtn.innerHTML = CLOSE_X_ICON + '<span class="pr-sr-only">Close</span>';
      closeBtn.addEventListener("click", () => (detailOverlay.hidden = true));
      detailPanel.appendChild(closeBtn);

      const titleEl = document.createElement("h2");
      titleEl.className = "pr-title";
      titleEl.style.paddingRight = "28px";
      titleEl.textContent = row.title;
      detailPanel.appendChild(titleEl);

      const priorityWrap = document.createElement("div");
      priorityWrap.className = "pr-form-divider";
      priorityWrap.innerHTML = badgeHtml(PRIORITY_META, row.priority);
      detailPanel.appendChild(priorityWrap);

      // Same 2x2 layout as llemr's real modal: Person/Project on the first
      // row, Date/Status on the second — llemr's own info grid has no due
      // date in it at all (that's a table-only column, see the Issues
      // table above), so this widget doesn't invent a spot for it either.
      const infoGrid = document.createElement("div");
      infoGrid.className = "pr-detail-info-grid";
      infoGrid.innerHTML = `
        <div class="pr-detail-info-item">${PERSON_ICON}<span>${row.reporterName ? esc(row.reporterName) : "Anonymous"}</span></div>
        <div class="pr-detail-info-item">${FOLDER_ICON}<span>${row.projectName ? esc(row.projectName) : "—"}</span></div>
        <div class="pr-detail-info-item">${CLOCK_ICON}<span>${formatDateTime(row.createdAt)}</span></div>
        <div class="pr-detail-info-item">${badgeHtml(STATUS_META, row.status)}</div>
      `;
      detailPanel.appendChild(infoGrid);

      const descSection = document.createElement("div");
      descSection.className = "pr-detail-section";
      descSection.innerHTML = `
        <span class="pr-detail-section-label">Description</span>
        ${
          row.description
            ? `<p class="pr-detail-section-body">${esc(row.description)}</p>`
            : `<p class="pr-detail-section-empty">No description provided</p>`
        }
      `;
      detailPanel.appendChild(descSection);

      // Only ever the reporter's own uploads (attachmentContext: "report" —
      // see public-report.service.ts's getById doc comment); a staff member
      // attaching something later through the dashboard never shows up here.
      const attachSection = document.createElement("div");
      attachSection.className = "pr-detail-section";
      const attachments = row.attachments ?? [];
      if (attachments.length === 0) {
        attachSection.innerHTML = `
          <span class="pr-detail-section-label">Attachments</span>
          <p class="pr-detail-section-empty">None</p>
        `;
      } else {
        const label = document.createElement("span");
        label.className = "pr-detail-section-label";
        label.textContent = "Attachments";
        attachSection.appendChild(label);

        const list = document.createElement("div");
        list.className = "pr-attachment-list";
        for (const a of attachments) {
          if (a.kind === "image") {
            const link = document.createElement("a");
            link.className = "pr-attachment-image";
            link.href = a.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.title = a.name;
            const img = document.createElement("img");
            img.src = a.url;
            img.alt = a.name;
            link.appendChild(img);
            const overlay = document.createElement("div");
            overlay.className = "pr-attachment-image-overlay";
            overlay.innerHTML = EYE_ICON;
            link.appendChild(overlay);
            list.appendChild(link);
          } else {
            const link = document.createElement("a");
            link.className = "pr-attachment-file";
            link.href = a.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.innerHTML = `<span class="pr-attachment-file-icon">${FILE_ICON}</span><span class="pr-attachment-file-name">${esc(a.name)}</span>`;
            list.appendChild(link);
          }
        }
        attachSection.appendChild(list);
      }
      detailPanel.appendChild(attachSection);
    }

    let loadState: "loading" | "loaded" | "error" = "loading";

    function renderRows() {
      if (loadState === "loading") {
        tbody.innerHTML = `<tr><td colspan="7" class="pr-empty">Loading…</td></tr>`;
        return;
      }
      if (loadState === "error") {
        tbody.innerHTML = `<tr><td colspan="7" class="pr-empty">Couldn't load issues — try Refresh.</td></tr>`;
        return;
      }

      const q = query.trim().toLowerCase();
      const filtered = q
        ? rows.filter(
            (r) =>
              r.title.toLowerCase().includes(q) ||
              r.status.toLowerCase().includes(q) ||
              r.priority.toLowerCase().includes(q) ||
              (r.reporterName ?? "").toLowerCase().includes(q),
          )
        : rows;

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="pr-empty">${
          rows.length === 0 ? "No issues found" : "No matching issues"
        }</td></tr>`;
        return;
      }

      tbody.innerHTML = filtered
        .map((r) => {
          const dueDate = r.dueDate ? formatDateTime(r.dueDate) : "--";
          const submittedBy = r.reporterName ? esc(r.reporterName) : "—";
          return `<tr data-row-id="${r.id}">
            <td>${formatDateTime(r.createdAt)}</td>
            <td class="pr-table-title" title="${esc(r.title)}">${esc(r.title)}</td>
            <td>${submittedBy}</td>
            <td>${badgeHtml(PRIORITY_META, r.priority)}</td>
            <td>${badgeHtml(STATUS_META, r.status)}</td>
            <td>${dueDate}</td>
            <td><button type="button" class="pr-btn-view" data-view-id="${r.id}">${EYE_ICON}<span>View</span></button></td>
          </tr>`;
        })
        .join("");
    }

    // Event delegation — tbody.innerHTML is rebuilt wholesale on every
    // render, which would silently drop any listeners bound to individual
    // rows/buttons; binding once on the stable tbody itself avoids that.
    tbody.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-view-id]");
      if (!btn) return;
      const row = rows.find((r) => r.id === btn.dataset.viewId);
      if (row) openDetail(row);
    });

    async function load() {
      loadState = "loading";
      renderRows();
      try {
        rows = await handlers.listReports();
        loadState = "loaded";
      } catch {
        rows = [];
        loadState = "error";
      }
      renderRows();
    }

    searchInput.addEventListener("input", () => {
      query = searchInput.value;
      renderRows();
    });
    refreshBtn.addEventListener("click", () => void load());

    void load();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    // Topmost layer closes first — the detail modal sits over the Issues
    // table (detailOverlay's higher z-index), so Escape should back out of
    // it one step at a time, same as its own close button does, not
    // dismiss the whole stack at once.
    if (!detailOverlay.hidden) detailOverlay.hidden = true;
    else if (!overlay.hidden || !issuesOverlay.hidden) close();
    else if (!menu.hidden) closeMenu();
  }

  function onOverlayClick(e: MouseEvent) {
    if (e.target === detailOverlay) {
      detailOverlay.hidden = true;
      return;
    }
    if (e.target === overlay || e.target === issuesOverlay) close();
  }

  function onDocumentClick(e: MouseEvent) {
    // Closes the menu on any click outside it (including outside the shadow
    // root entirely) without closing it right back via the trigger's own
    // click — composedPath sees through the shadow boundary, a plain
    // `e.target` on a shadow-rooted trigger would just read as `host`.
    if (menu.hidden) return;
    const path = e.composedPath();
    if (path.includes(menu) || path.includes(trigger)) return;
    closeMenu();
  }

  trigger.addEventListener("click", toggleMenu);
  newIssueItem.addEventListener("click", open);
  viewIssuesItem.addEventListener("click", openIssues);
  overlay.addEventListener("click", onOverlayClick);
  issuesOverlay.addEventListener("click", onOverlayClick);
  detailOverlay.addEventListener("click", onOverlayClick);
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("click", onDocumentClick);

  function destroy() {
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("click", onDocumentClick);
    host.remove();
  }

  return { open, close, destroy };
}
