import type { CapturedContext, ReportInput, Reporter } from "./types";

export interface SubmitPayload extends ReportInput {
  projectId?: string;
  reporter?: Reporter;
  context?: CapturedContext;
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
 */
export async function submitReport(
  apiBaseUrl: string,
  apiKey: string,
  payload: SubmitPayload,
): Promise<{ id: string }> {
  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl.replace(/\/+$/, "")}/public/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(payload),
    });
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
