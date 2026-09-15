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

/** Maps the backend's `ReportStatus` (report.constants.ts) to a label + badge tone. */
const STATUS_META: Record<string, { label: string; tone: string }> = {
  new: { label: "New", tone: "pr-badge-new" },
  in_progress: { label: "In Progress", tone: "pr-badge-progress" },
  resolved: { label: "Resolved", tone: "pr-badge-resolved" },
  blocked: { label: "Blocked", tone: "pr-badge-blocked" },
  closed: { label: "Closed", tone: "pr-badge-closed" },
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

.pr-issue-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.pr-issue-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}
.pr-issue-main { min-width: 0; }
.pr-issue-title {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pr-issue-date { font-size: 11px; color: #9ca3af; margin-top: 2px; }
.pr-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 999px;
}
.pr-badge-new { background: #eef2ff; color: #4338ca; }
.pr-badge-progress { background: #fffbeb; color: #b45309; }
.pr-badge-resolved { background: #ecfdf5; color: #047857; }
.pr-badge-blocked { background: #fef2f2; color: #b91c1c; }
.pr-badge-closed { background: #f3f4f6; color: #4b5563; }
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

  function relativeDate(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const diffMs = Date.now() - then;
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  /**
   * "View Issues" — a popup here, not a page navigation like llemr's
   * equivalent, since this widget has no page of its own on the host site
   * to send anyone to (see this file's top-level doc comment). Shows only
   * what *this browser* has submitted (storage.ts) — there is no "list
   * every report" endpoint, by design (public-report.service.ts).
   */
  async function openIssues() {
    closeMenu();
    issuesOverlay.hidden = false;
    issuesPanel.innerHTML = "";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "pr-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", close);
    issuesPanel.appendChild(closeBtn);

    const title = document.createElement("h2");
    title.className = "pr-title";
    title.textContent = "Your Issues";
    issuesPanel.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.className = "pr-subtitle";
    subtitle.textContent = "Issues you've reported from this browser.";
    issuesPanel.appendChild(subtitle);

    const tracked = handlers.getTrackedReports();
    if (tracked.length === 0) {
      const empty = document.createElement("p");
      empty.className = "pr-empty";
      empty.textContent = "You haven't reported anything yet.";
      issuesPanel.appendChild(empty);
      return;
    }

    const list = document.createElement("ul");
    list.className = "pr-issue-list";
    issuesPanel.appendChild(list);

    for (const item of tracked) {
      const row = document.createElement("li");
      row.className = "pr-issue-row";

      const main = document.createElement("div");
      main.className = "pr-issue-main";
      const titleEl = document.createElement("div");
      titleEl.className = "pr-issue-title";
      titleEl.textContent = item.title;
      const dateEl = document.createElement("div");
      dateEl.className = "pr-issue-date";
      dateEl.textContent = relativeDate(item.submittedAt);
      main.appendChild(titleEl);
      main.appendChild(dateEl);
      row.appendChild(main);

      const badge = document.createElement("span");
      badge.className = "pr-badge pr-badge-new";
      badge.textContent = "…";
      row.appendChild(badge);

      list.appendChild(row);

      // Fetched per-row, independently — one slow/failed lookup (a report
      // since deleted, a network blip) shouldn't block the rest of the
      // list from showing their real status.
      handlers
        .fetchReportStatus(item.id)
        .then((status) => {
          const meta = STATUS_META[status.status] ?? { label: status.status, tone: "pr-badge-new" };
          badge.className = `pr-badge ${meta.tone}`;
          badge.textContent = meta.label;
        })
        .catch(() => {
          badge.className = "pr-badge pr-badge-closed";
          badge.textContent = "Unknown";
        });
    }
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
