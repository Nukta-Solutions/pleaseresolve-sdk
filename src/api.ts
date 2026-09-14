import type { CapturedContext, ReportInput, Reporter } from "./types";

export interface SubmitPayload extends ReportInput {
  projectId?: string;
  reporter?: Reporter;
  context?: CapturedContext;
  /** From `captureScreenshot()` (Phase 3) — switches the request to `multipart/form-data`. */
  screenshot?: Blob;
}

export class PleaseResolveApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "PleaseResolveApiError";
  }
}

/**
 * Talks to `POST /api/v1/public/reports` (pleaseresolve-backend's
 * `public-report.route.ts`). Matches that endpoint's contract exactly —
 * see CLIENT_INTEGRATIONS_PLAN.md §3.2 for the payload shape and
 * pleaseresolve-backend/src/modules/public-report/ for the server side.
 *
 * Plain JSON when there's no screenshot (the common case); `multipart/
 * form-data` with a `payload` field (same JSON, stringified) + a
 * `screenshot` file field otherwise — mirrors the legacy external API's
 * identical "JSON body, or a `payload` field alongside real files" split,
 * which the backend's `public-report.controller.ts` branches on the same
 * way.
 */
export async function submitReport(
  apiBaseUrl: string,
  apiKey: string,
  payload: SubmitPayload,
): Promise<{ id: string }> {
  const { screenshot, ...jsonFields } = payload;
  const url = `${apiBaseUrl.replace(/\/+$/, "")}/public/reports`;

  let res: Response;
  try {
    if (screenshot) {
      const form = new FormData();
      form.append("payload", JSON.stringify(jsonFields));
      form.append("screenshot", screenshot, "screenshot.png");
      res = await fetch(url, {
        method: "POST",
        headers: { "X-Api-Key": apiKey },
        body: form,
      });
    } else {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify(jsonFields),
      });
    }
  } catch {
    // A network failure (offline, CORS misconfiguration, DNS) has no
    // response to read a message from — this is the one case the caller
    // should show a generic "couldn't reach the server" message for.
    throw new PleaseResolveApiError("Could not reach the reporting server");
  }

  let body: { success?: boolean; message?: string; data?: { _id?: string } } | null =
    null;
  try {
    body = await res.json();
  } catch {
    // fall through — body stays null, handled below
  }

  if (!res.ok || !body?.success) {
    throw new PleaseResolveApiError(
      body?.message || `Request failed (${res.status})`,
      res.status,
    );
  }

  const id = body.data?._id;
  if (!id) {
    throw new PleaseResolveApiError("Server response was missing the report id");
  }
  return { id };
}
