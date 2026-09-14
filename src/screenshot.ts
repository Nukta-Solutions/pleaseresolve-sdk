// `import type` only — erased at compile time, never bundled. html2canvas
// itself (~200KB minified) is loaded at *runtime* from a CDN, on demand,
// the first time a screenshot is actually captured — see the note below on
// why a bundled import doesn't work here.
import type Html2Canvas from "html2canvas";

declare global {
  interface Window {
    html2canvas?: typeof Html2Canvas;
  }
}

const HTML2CANVAS_CDN_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";

/** The widget's own host element — never screenshot the bug-report form itself. */
const WIDGET_SELECTOR = "[data-pleaseresolve-widget]";

let loadPromise: Promise<typeof Html2Canvas> | null = null;

/**
 * Loads html2canvas from a CDN via a plain `<script>` tag the first time
 * it's needed, and reuses that one load for every later capture.
 *
 * Why not `import html2canvas from "html2canvas"` like a normal dependency:
 * that bundles all ~200KB of it straight into `dist/widget.global.js` — the
 * *initial* script-tag load every visitor to a customer's site pays,
 * whether or not anyone ever reports an issue. That blows the ~30KB budget
 * this SDK is built around by 7x (CLIENT_INTEGRATIONS_PLAN.md §4.3 — a
 * correction made here after actually measuring the bundled size, not a
 * decision made in the abstract). Loading it on demand, only once someone
 * opens the report form, keeps every other page load light and costs
 * nothing until the feature is actually used.
 */
function loadHtml2Canvas(): Promise<typeof Html2Canvas> {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = HTML2CANVAS_CDN_URL;
    script.async = true;
    script.onload = () => {
      if (window.html2canvas) resolve(window.html2canvas);
      else reject(new Error("html2canvas loaded but did not define window.html2canvas"));
    };
    script.onerror = () => reject(new Error("Failed to load html2canvas from CDN"));
    document.head.appendChild(script);
  });
  return loadPromise;
}

/**
 * Phase 3 (CLIENT_INTEGRATIONS_PLAN.md §4.2/§10): best-effort only. A
 * capture failure (CDN unreachable, a tainted canvas from a cross-origin
 * image, an unusual page layout) must never block the actual report — this
 * returns `undefined` rather than throwing, and the caller submits without
 * a screenshot in that case.
 */
export async function captureScreenshot(): Promise<Blob | undefined> {
  try {
    const html2canvas = await loadHtml2Canvas();
    const canvas = await html2canvas(document.body, {
      logging: false,
      useCORS: true,
      ignoreElements: (el) => el.matches?.(WIDGET_SELECTOR) ?? false,
    });
    return await new Promise<Blob | undefined>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ?? undefined), "image/png", 0.85);
    });
  } catch {
    return undefined;
  }
}
