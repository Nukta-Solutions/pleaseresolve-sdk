import { init } from "./index";

/**
 * The script-tag entry point (CLIENT_INTEGRATIONS_PLAN.md §5):
 *
 *   <script src=".../widget.js" data-key="pk_live_..." data-project="..." async></script>
 *
 * `document.currentScript` is only valid synchronously during a classic
 * script's initial execution (still true for `async` — just not for a
 * dynamically-`import()`ed or deferred-callback context), which is exactly
 * when this file's top-level code runs. `data-key` absent just means
 * "loaded for manual `PleaseResolve.init(...)` instead" — not an error.
 */
function autoInit(): void {
  const script = document.currentScript as HTMLScriptElement | null;
  const key = script?.dataset.key;
  if (!key) return;

  init({
    key,
    projectId: script?.dataset.project,
    apiBaseUrl: script?.dataset.apiBaseUrl,
    widget: script?.dataset.widget !== "false",
  });
}

autoInit();

export * from "./index";
