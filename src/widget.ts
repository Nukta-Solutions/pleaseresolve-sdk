import type { ReportInput, ReportPriority, Reporter } from "./types";

export interface WidgetHandlers {
  onSubmit: (input: ReportInput, screenshot?: Blob) => Promise<{ id: string }>;
  getReporter: () => Reporter | undefined;
  /** Called with the form's name/email fields right before `onSubmit`, if either was filled in. */
  setReporter: (reporter: Reporter) => void;
  /**
   * Present only when `init({ screenshot: false })` wasn't set. Kicked off
   * as soon as the form opens (not on submit) so the reporter sees the
   * preview and can opt out *before* anything is sent — headless `report()`
   * never gets this at all, on purpose (see types.ts's `screenshot` doc).
   */
  captureScreenshot?: () => Promise<Blob | undefined>;
}

export interface WidgetHandle {
  open: () => void;
  close: () => void;
  destroy: () => void;
}

const PRIORITIES: { value: ReportPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

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
  padding: 12px 16px;
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
.pr-overlay[hidden], .pr-trigger[hidden] { display: none; }

.pr-panel {
  width: 100%;
  max-width: 400px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
.pr-title { margin: 0 0 4px; font-size: 16px; font-weight: 700; color: #111827; }
.pr-subtitle { margin: 0 0 16px; font-size: 13px; color: #6b7280; }
.pr-field { margin-bottom: 12px; }
.pr-label { display: block; margin-bottom: 4px; font-size: 12px; font-weight: 600; color: #374151; }
.pr-input, .pr-textarea, .pr-select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #111827;
}
.pr-input:focus, .pr-textarea:focus, .pr-select:focus {
  outline: 2px solid #6366f1;
  outline-offset: 1px;
  border-color: #6366f1;
}
.pr-textarea { min-height: 72px; resize: vertical; }
.pr-row { display: flex; gap: 8px; }
.pr-row > .pr-field { flex: 1; }
.pr-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.pr-btn {
  padding: 8px 14px;
  border-radius: 8px;
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

.pr-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
}
.pr-checkbox-label input[type="checkbox"] { width: 16px; height: 16px; accent-color: #6366f1; }
.pr-screenshot-preview {
  display: block;
  margin-top: 8px;
  max-width: 100%;
  max-height: 120px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  object-fit: cover;
}
`;

/**
 * The default UI, per CLIENT_INTEGRATIONS_PLAN.md §4.1 — this is what
 * `PleaseResolve.init({ widget: true })` (the default) mounts. Built in a
 * Shadow DOM so it neither inherits the host page's CSS nor leaks its own
 * styles onto it — a real concern for anything embedded on someone else's
 * site.
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
  trigger.textContent = "Report an issue";
  trigger.setAttribute("aria-label", "Report an issue");
  root.appendChild(trigger);

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

  let screenshotBlob: Blob | undefined;
  let screenshotUrl: string | undefined;
  let includeScreenshot = true;

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
    title.textContent = "Report an issue";
    panel.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.className = "pr-subtitle";
    subtitle.textContent = "Let us know what went wrong — we'll take it from here.";
    panel.appendChild(subtitle);

    const errorBox = document.createElement("div");
    errorBox.className = "pr-error";
    errorBox.hidden = true;
    panel.appendChild(errorBox);

    const form = document.createElement("form");
    panel.appendChild(form);

    const reporter = handlers.getReporter();

    const titleField = fieldInput("title", "What happened?", "input", true);
    const descField = fieldInput(
      "description",
      "Details (optional)",
      "textarea",
      false,
    );
    form.appendChild(titleField.wrapper);
    form.appendChild(descField.wrapper);

    const row = document.createElement("div");
    row.className = "pr-row";
    const priorityField = fieldSelect();
    const nameField = fieldInput("name", "Your name (optional)", "input", false);
    row.appendChild(priorityField.wrapper);
    row.appendChild(nameField.wrapper);
    form.appendChild(row);
    if (reporter?.name) (nameField.el as HTMLInputElement).value = reporter.name;

    const emailField = fieldInput("email", "Your email (optional)", "input", false);
    (emailField.el as HTMLInputElement).type = "email";
    form.appendChild(emailField.wrapper);
    if (reporter?.email) (emailField.el as HTMLInputElement).value = reporter.email;

    if (handlers.captureScreenshot) {
      form.appendChild(buildScreenshotField());
    }

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
    submitBtn.textContent = "Submit report";
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

      const name = (nameField.el as HTMLInputElement).value.trim();
      const email = (emailField.el as HTMLInputElement).value.trim();
      if (name || email) {
        handlers.setReporter({ name: name || undefined, email: email || undefined });
      }

      handlers
        .onSubmit(
          {
            title: titleValue,
            description:
              (descField.el as HTMLTextAreaElement).value.trim() || undefined,
            priority: (priorityField.el as HTMLSelectElement).value as ReportPriority,
          },
          includeScreenshot ? screenshotBlob : undefined,
        )
        .then(() => {
          renderSuccess();
        })
        .catch((err: unknown) => {
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit report";
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
   * The consent point (types.ts's `screenshot` doc): the reporter sees
   * exactly what was captured and can uncheck it before anything is sent —
   * this is why capture only ever happens for the form, never for headless
   * `report()` calls.
   */
  function buildScreenshotField(): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "pr-field pr-screenshot-field";

    const label = document.createElement("label");
    label.className = "pr-checkbox-label";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = includeScreenshot && !!screenshotUrl;
    checkbox.disabled = !screenshotUrl;
    checkbox.addEventListener("change", () => {
      includeScreenshot = checkbox.checked;
    });
    const text = document.createElement("span");
    text.textContent = screenshotUrl
      ? "Include a screenshot of this page"
      : "Screenshot unavailable for this page";
    label.appendChild(checkbox);
    label.appendChild(text);
    wrapper.appendChild(label);

    if (screenshotUrl) {
      const img = document.createElement("img");
      img.className = "pr-screenshot-preview";
      img.src = screenshotUrl;
      img.alt = "Captured screenshot preview";
      wrapper.appendChild(img);
    }

    return wrapper;
  }

  async function open() {
    // Capture *before* the form (with its text inputs) renders at all,
    // rather than kicking it off and re-rendering when it resolves — a
    // re-render mid-capture would wipe out anything the reporter had
    // already started typing. html2canvas is fast enough on a real page
    // that this reads as a normal open, not a stall.
    overlay.hidden = false;
    panel.innerHTML = "";
    const loading = document.createElement("p");
    loading.className = "pr-subtitle";
    loading.style.textAlign = "center";
    loading.style.padding = "24px 0";
    loading.textContent = "Loading…";
    panel.appendChild(loading);

    if (screenshotUrl) URL.revokeObjectURL(screenshotUrl);
    screenshotBlob = undefined;
    screenshotUrl = undefined;
    if (handlers.captureScreenshot) {
      // Re-captured on every open, not cached — the page may have changed
      // since the reporter last opened the form, and staleness here is
      // worse than the small extra cost of doing it again.
      screenshotBlob = await handlers.captureScreenshot();
      if (screenshotBlob) screenshotUrl = URL.createObjectURL(screenshotBlob);
    }
    render();
  }

  function close() {
    overlay.hidden = true;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && !overlay.hidden) close();
  }

  function onOverlayClick(e: MouseEvent) {
    if (e.target === overlay) close();
  }

  trigger.addEventListener("click", open);
  overlay.addEventListener("click", onOverlayClick);
  document.addEventListener("keydown", onKeydown);

  function destroy() {
    if (screenshotUrl) URL.revokeObjectURL(screenshotUrl);
    document.removeEventListener("keydown", onKeydown);
    host.remove();
  }

  return { open, close, destroy };
}
