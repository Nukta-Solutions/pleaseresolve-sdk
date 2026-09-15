import type { ReportInput, ReportPriority } from "./types";
import type { ReportStatusSummary } from "./api";
import type { TrackedReport } from "./storage";

export interface WidgetHandlers {
  onSubmit: (input: ReportInput, attachments: File[]) => Promise<{ id: string }>;
  /** This browser's own submission history — see storage.ts. Sync; it's a plain localStorage read. */
  getTrackedReports: () => TrackedReport[];
  /** Live status for one tracked report — see api.ts's `fetchReport`. */
  fetchReportStatus: (id: string) => Promise<ReportStatusSummary>;
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

const EYE_ICON = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M1 7.5C2.2 4.5 4.6 2.7 7.5 2.7C10.4 2.7 12.8 4.5 14 7.5C12.8 10.5 10.4 12.3 7.5 12.3C4.6 12.3 2.2 10.5 1 7.5Z" stroke="currentColor" stroke-width="1.4"/>
  <circle cx="7.5" cy="7.5" r="2.1" stroke="currentColor" stroke-width="1.4"/>
</svg>`;

const UPLOAD_ICON = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M10 13V3M10 3L6 7M10 3L14 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M3 13V15.5C3 16.3284 3.67157 17 4.5 17H15.5C16.3284 17 17 16.3284 17 15.5V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

const X_ICON = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
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
.pr-title { margin: 0 0 4px; font-size: 18px; font-weight: 700; color: #0f172a; }
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
.pr-close {
  position: absolute;
  top: 12px;
  right: 12px;
  border: none;
  background: transparent;
  font-size: 18px;
  line-height: 1;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
}
.pr-close:hover { color: #374151; }

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
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
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
.pr-detail-row td { background: #f8fafc; padding: 12px 16px !important; }
.pr-detail-desc { font-size: 13px; color: #475569; white-space: pre-wrap; margin: 0; }
.pr-detail-empty { font-size: 13px; color: #94a3b8; font-style: italic; margin: 0; }
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
    closeBtn.textContent = "×";
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
    closeBtn.textContent = "×";
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
   * to send anyone to (see this file's top-level doc comment). Deliberately
   * styled as a 1:1 clone of llemr's real admin/reports "Issues" table
   * (ReportList.tsx/ReportBadges.tsx) — same toolbar, table, and badge
   * colors — minus the columns/actions that table has no honest data for
   * here: Submitted-by and Due Date aren't returned by this widget's public
   * read API at all (public-report.service.ts's getById is deliberately
   * minimal), and there's no Action/View-details column since there's no
   * extra detail beyond what's already in the row to show.
   *
   * Shows only what *this browser* has submitted (storage.ts) — there is
   * no "list every report" endpoint, by design (public-report.service.ts).
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
    closeBtn.textContent = "×";
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

    type Row = TrackedReport & {
      status?: string;
      priority?: string;
      dueDate?: string | null;
      description?: string | null;
      reporterName?: string | null;
      failed?: boolean;
    };
    let rows: Row[] = handlers.getTrackedReports();
    let query = "";
    const expanded = new Set<string>();

    function badgeHtml(meta: Record<string, { label: string; tone: string }>, key: string | undefined, loading: boolean, failed: boolean): string {
      if (failed) return `<span class="pr-badge pr-badge-neutral">Unknown</span>`;
      if (loading) return `<span class="pr-badge pr-badge-neutral">…</span>`;
      // Falls back to a plain neutral badge for values llemr's own UI has no
      // tier for at all (report()'s ReportPriority allows "urgent"/
      // "critical", beyond the form's Low/Medium/High) — still shown, just
      // title-cased rather than the raw lowercase API value.
      const fallbackLabel = key ? key.charAt(0).toUpperCase() + key.slice(1) : "—";
      const m = key ? (meta[key] ?? { label: fallbackLabel, tone: "pr-badge-neutral" }) : { label: "—", tone: "pr-badge-neutral" };
      return `<span class="pr-badge ${m.tone}">${m.label}</span>`;
    }

    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

    function renderRows() {
      const q = query.trim().toLowerCase();
      const filtered = q
        ? rows.filter(
            (r) =>
              r.title.toLowerCase().includes(q) ||
              (r.status ?? "").toLowerCase().includes(q) ||
              (r.priority ?? "").toLowerCase().includes(q) ||
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
          const loading = r.status === undefined && !r.failed;
          const dueDate = r.dueDate ? formatDateTime(r.dueDate) : "--";
          const submittedBy = r.reporterName ? esc(r.reporterName) : "—";
          const isOpen = expanded.has(r.id);
          const mainRow = `<tr data-row-id="${r.id}">
            <td>${formatDateTime(r.submittedAt)}</td>
            <td class="pr-table-title" title="${esc(r.title)}">${esc(r.title)}</td>
            <td>${submittedBy}</td>
            <td>${badgeHtml(PRIORITY_META, r.priority, loading, !!r.failed)}</td>
            <td>${badgeHtml(STATUS_META, r.status, loading, !!r.failed)}</td>
            <td>${dueDate}</td>
            <td><button type="button" class="pr-btn-view" data-view-id="${r.id}" ${loading ? "disabled" : ""}>${EYE_ICON}<span>View</span></button></td>
          </tr>`;
          if (!isOpen) return mainRow;
          const desc = r.description
            ? `<p class="pr-detail-desc">${esc(r.description)}</p>`
            : `<p class="pr-detail-empty">No description provided</p>`;
          return `${mainRow}<tr class="pr-detail-row"><td colspan="7">${desc}</td></tr>`;
        })
        .join("");
    }

    // Event delegation — tbody.innerHTML is rebuilt wholesale on every
    // render, which would silently drop any listeners bound to individual
    // rows/buttons; binding once on the stable tbody itself avoids that.
    tbody.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-view-id]");
      if (!btn) return;
      const id = btn.dataset.viewId as string;
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      renderRows();
    });

    async function loadStatuses() {
      expanded.clear();
      rows = rows.map((r) => ({ id: r.id, title: r.title, submittedAt: r.submittedAt }));
      renderRows();
      // Fetched per-row, independently — one slow/failed lookup (a report
      // since deleted, a network blip) shouldn't block the rest of the
      // table from showing real data.
      await Promise.all(
        rows.map(async (r) => {
          try {
            const result = await handlers.fetchReportStatus(r.id);
            r.status = result.status;
            r.priority = result.priority;
            r.dueDate = result.dueDate;
            r.description = result.description;
            r.reporterName = result.reporterName;
          } catch {
            r.failed = true;
          }
          renderRows();
        }),
      );
    }

    searchInput.addEventListener("input", () => {
      query = searchInput.value;
      renderRows();
    });
    refreshBtn.addEventListener("click", () => void loadStatuses());

    void loadStatuses();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    if (!overlay.hidden || !issuesOverlay.hidden) close();
    else if (!menu.hidden) closeMenu();
  }

  function onOverlayClick(e: MouseEvent) {
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
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("click", onDocumentClick);

  function destroy() {
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("click", onDocumentClick);
    host.remove();
  }

  return { open, close, destroy };
}
