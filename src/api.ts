import type { CapturedContext, ReportInput, Reporter } from "./types";

export interface SubmitPayload extends ReportInput {
  projectId?: string;
  reporter?: Reporter;
  context?: CapturedContext;
  /** From the built-in form's attachment dropzone (widget.ts) — switches the request to `multipart/form-data`. */
  attachments?: File[];
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
 * Plain JSON when there are no attachments (the common case, and always
 * true for headless `report()` calls); `multipart/form-data` with a
 * `payload` field (same JSON, stringified) + one or more `attachments`
 * file fields otherwise — mirrors the legacy external API's identical
 * "JSON body, or a `payload` field alongside real files" split, which the
 * backend's `public-report.controller.ts` branches on the same way.
 */
export async function submitReport(
  apiBaseUrl: string,
  apiKey: string,
  payload: SubmitPayload,
): Promise<{ id: string }> {
  const { attachments, ...jsonFields } = payload;
  const url = `${apiBaseUrl.replace(/\/+$/, "")}/public/reports`;

  let res: Response;
  try {
    if (attachments && attachments.length > 0) {
      const form = new FormData();
      form.append("payload", JSON.stringify(jsonFields));
      for (const file of attachments) {
        form.append("attachments", file, file.name);
      }
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

export interface ReportStatusSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  /** Staff-set workflow field — null if never set. */
  dueDate: string | null;
  /** The reporter's own submitted text — not staff-internal notes/comments. */
  description: string | null;
  /** Never `reporterEmail` — see public-report.service.ts's `getById` doc comment for why. */
  reporterName: string | null;
  projectName: string | null;
  /** Only ones uploaded through this same widget's own attachment dropzone — never staff-added ones. */
  attachments: Array<{ url: string; name: string; contentType: string; kind: "image" | "file" }>;
}

/**
 * Talks to `GET /api/v1/public/reports/:id` — backs the Action column's
 * "View" (widget.ts).
 */
export async function fetchReport(
  apiBaseUrl: string,
  apiKey: string,
  reportId: string,
): Promise<ReportStatusSummary> {
  const url = `${apiBaseUrl.replace(/\/+$/, "")}/public/reports/${encodeURIComponent(reportId)}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { "X-Api-Key": apiKey } });
  } catch {
    throw new PleaseResolveApiError("Could not reach the reporting server");
  }

  let body: { success?: boolean; message?: string; data?: ReportStatusSummary } | null = null;
  try {
    body = await res.json();
  } catch {
    // fall through — body stays null, handled below
  }

  if (!res.ok || !body?.success || !body.data) {
    throw new PleaseResolveApiError(
      body?.message || `Request failed (${res.status})`,
      res.status,
    );
  }
  return body.data;
}

/**
 * Talks to `GET /api/v1/public/reports` — backs "View Issues" (widget.ts).
 * Lists every report for the project, not scoped to this browser — see
 * the backend's `public-report.service.ts` class-level doc comment for the
 * trade-off this represents and why it was accepted.
 */
export async function listReports(
  apiBaseUrl: string,
  apiKey: string,
  projectId?: string,
): Promise<ReportStatusSummary[]> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  const url = `${apiBaseUrl.replace(/\/+$/, "")}/public/reports${qs}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { "X-Api-Key": apiKey } });
  } catch {
    throw new PleaseResolveApiError("Could not reach the reporting server");
  }

  let body: { success?: boolean; message?: string; data?: ReportStatusSummary[] } | null = null;
  try {
    body = await res.json();
  } catch {
    // fall through — body stays null, handled below
  }

  if (!res.ok || !body?.success || !body.data) {
    throw new PleaseResolveApiError(
      body?.message || `Request failed (${res.status})`,
      res.status,
    );
  }
  return body.data;
}
