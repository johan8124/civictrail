/**
 * CivicTrail triage API.
 *
 * POST /api/triage
 *
 * Runs the Strands agent (classify + route lookup + evidence inspection +
 * packet validation via tools), then computes the authoritative readiness
 * result with the deterministic rule engine. The agent output never decides
 * readiness.
 *
 * Secrets: GROQ_API_KEY is only read server-side and is never included in
 * any response.
 */
import { TRIAGE_REQUEST_SCHEMA } from "@/lib/types/civictrail";
import type { TriageResponse } from "@/lib/types/civictrail";
import { runTriage } from "@/lib/agent/triage-orchestrator";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = TRIAGE_REQUEST_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: "Invalid request.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const result: TriageResponse = await runTriage(parsed.data);

  return Response.json(result, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
