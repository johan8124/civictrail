/**
 * Agent completion gate tests (hermetic — no external network).
 *
 * Run with: npm test  (tsx tests/agent-completion.test.ts)
 *
 * These tests prove the completion/integrity logic that separates "the agent
 * produced some text" from "the agent completed the required four-tool
 * sequence", and that a partial, out-of-order or cancelled run can never be
 * reported as a completed agent analysis:
 *
 * 1. exact four-tool sequence                    -> complete
 * 2. missing required tool                       -> incomplete
 * 3. required tools out of order                 -> incomplete
 * 4. only classify_issue called                  -> incomplete
 * 5. cancelled run (wall-clock deadline)         -> incomplete, disclosed
 * 6. validate_action_packet absent or rejected   -> incomplete
 * 7. deterministic fallback keeps rule-engine readiness
 * 8. agentUsed stays false when the agent never called a tool
 * 9. a real four-tool agent run marks agentUsed true and may use its summary
 *
 * Every model endpoint here is a local stub or a refusing local port; no
 * request ever reaches Groq and no API key is required.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { configureLogging } from "@strands-agents/sdk";
import {
  createCollector,
  createCivicTrailTools,
  evaluateAgentCompletion,
  REQUIRED_TOOL_SEQUENCE,
  type AgentRunCollector,
} from "../lib/agent/agent-tools";
import { runTriage } from "../lib/agent/triage-orchestrator";
import { computeReadiness } from "../lib/readiness/engine";
import type { EvidenceRecord, TriageRequest } from "../lib/types/civictrail";
import { CASE_A_DESCRIPTION, CASE_A_EVIDENCE, CASE_B_EVIDENCE } from "../lib/demo/cyber-demo";
import { CASE_N1_EVIDENCE } from "../lib/demo/consumer-demo";

let passed = 0;
function report(name: string): void {
  passed += 1;
  console.log(`ok - ${name}`);
}

/* This suite reports its own results — silence the SDK's info-level tool logs. */
configureLogging({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });

/** Hermetic model endpoint guard: no scenario may point at a real provider. */
function assertHermeticEndpoint(): void {
  const base = process.env.GROQ_BASE_URL ?? "";
  assert.ok(
    base.startsWith("http://127.0.0.1:") || base.startsWith("http://localhost:"),
    `model endpoint must stay local during tests, saw "${base}"`,
  );
}

const CONSUMER_DESCRIPTION =
  CASE_N1_EVIDENCE.problemDescription ??
  "The online grocery store delivered a damaged appliance and the seller refuses a replacement.";

const CONSUMER_EVIDENCE: EvidenceRecord = CASE_N1_EVIDENCE;

/**
 * Text-only projection of an evidence record: the agent tools accept plain
 * text metadata, never files or structured upload metadata.
 */
function textEvidence(evidence: EvidenceRecord): Record<string, string> {
  const text: Record<string, string> = {};
  for (const [key, value] of Object.entries(evidence)) {
    if (typeof value === "string") text[key] = value;
  }
  return text;
}

const CONSUMER_TOOL_EVIDENCE = textEvidence(CONSUMER_EVIDENCE);

/** Runs the real per-run tool wrappers in the given order (no model involved). */
async function collectSequence(names: readonly string[]): Promise<AgentRunCollector> {
  const collector = createCollector();
  const [classify, route, inspect, validate] = createCivicTrailTools(collector);
  for (const name of names) {
    if (name === "classify_issue") {
      await classify.invoke({
        issueDescription: CONSUMER_DESCRIPTION,
        workflow: "consumer_grievance",
        rationale: "Synthetic consumer transaction problem involving a seller and goods.",
        confidence: 0.9,
      });
    } else if (name === "lookup_official_route") {
      await route.invoke({ workflow: "consumer_grievance" });
    } else if (name === "inspect_evidence") {
      await inspect.invoke({ workflow: "consumer_grievance", evidence: CONSUMER_TOOL_EVIDENCE });
    } else if (name === "validate_action_packet") {
      await validate.invoke({ workflow: "consumer_grievance", evidence: CONSUMER_TOOL_EVIDENCE });
    } else {
      throw new Error(`unknown tool in test sequence: ${name}`);
    }
  }
  return collector;
}

/* ------------------------------------------------------------------ */
/* Hermetic model stub (OpenAI-compatible SSE)                          */
/* ------------------------------------------------------------------ */

function sseChunk(delta: object, finishReason: string | null): string {
  const payload = {
    id: "chatcmpl-hermetic-test",
    object: "chat.completion.chunk",
    created: 0,
    model: "hermetic-test-model",
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

const SSE_USAGE = `data: ${JSON.stringify({
  id: "chatcmpl-hermetic-test",
  object: "chat.completion.chunk",
  created: 0,
  model: "hermetic-test-model",
  choices: [],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
})}\n\n`;

const SSE_END = `${SSE_USAGE}data: [DONE]\n\n`;

function sseToolCall(name: string, args: unknown): string {
  return (
    sseChunk(
      {
        role: "assistant",
        tool_calls: [
          { index: 0, id: `call_${name}`, type: "function", function: { name, arguments: "" } },
        ],
      },
      null,
    ) +
    sseChunk({ tool_calls: [{ index: 0, function: { arguments: JSON.stringify(args) } }] }, null) +
    sseChunk({}, "tool_calls") +
    SSE_END
  );
}

function sseText(text: string): string {
  return (
    sseChunk({ role: "assistant", content: "" }, null) +
    sseChunk({ content: text }, null) +
    sseChunk({}, "stop") +
    SSE_END
  );
}

/** Synthetic tool arguments used by the stub model. */
const STUB_TOOL_ARGS: Record<string, unknown> = {
  classify_issue: {
    issueDescription: CONSUMER_DESCRIPTION,
    workflow: "consumer_grievance",
    rationale: "Synthetic consumer transaction problem involving a seller and goods.",
    confidence: 0.9,
  },
  lookup_official_route: { workflow: "consumer_grievance" },
  inspect_evidence: { workflow: "consumer_grievance", evidence: CONSUMER_TOOL_EVIDENCE },
  validate_action_packet: { workflow: "consumer_grievance", evidence: CONSUMER_TOOL_EVIDENCE },
};

/**
 * Stub that plays a compliant model: it emits the next required tool call
 * based on how many tool results the incoming request already carries, or a
 * plain text answer once the sequence is done.
 */
function nextRequiredTool(body: string): string | null {
  const payload = JSON.parse(body) as { messages?: Array<{ role?: string }> };
  const toolResults = (payload.messages ?? []).filter((m) => m.role === "tool").length;
  return REQUIRED_TOOL_SEQUENCE[toolResults] ?? null;
}

async function withStubModel<T>(
  respond: (body: string) => string,
  fn: () => Promise<T>,
): Promise<T> {
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (part) => (body += part));
    request.on("end", () => {
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
      response.end(respond(body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  process.env.GROQ_BASE_URL = `http://127.0.0.1:${port}/v1`;
  try {
    return await fn();
  } finally {
    server.close();
  }
}

async function runHermeticTriage(request: TriageRequest) {
  assertHermeticEndpoint();
  return runTriage(request);
}

async function main(): Promise<void> {
  /* Hermetic model config: local stub endpoints only, never a real provider. */
  process.env.GROQ_API_KEY = "hermetic-test-key";
  process.env.GROQ_MODEL = "hermetic-test-model";

  // 1. Exact four-tool sequence -> complete.
  {
    const status = evaluateAgentCompletion(await collectSequence(REQUIRED_TOOL_SEQUENCE));
    assert.equal(status.sequenceComplete, true);
    assert.equal(status.completedCount, 4);
    assert.equal(status.missingTool, null);
    assert.deepEqual(status.toolsCalled, [...REQUIRED_TOOL_SEQUENCE]);
    report("exact four-tool sequence is complete");
  }

  // 2. A missing required tool -> incomplete.
  {
    const status = evaluateAgentCompletion(
      await collectSequence(["classify_issue", "lookup_official_route", "validate_action_packet"]),
    );
    assert.equal(status.sequenceComplete, false);
    assert.equal(status.missingTool, "inspect_evidence");
    assert.equal(status.completedCount, 2);
    assert.ok(status.reason.includes("inspect_evidence"), status.reason);
    report("missing required tool is incomplete");
  }

  // 3. Required tools out of order -> incomplete.
  {
    const status = evaluateAgentCompletion(
      await collectSequence([
        "classify_issue",
        "inspect_evidence",
        "lookup_official_route",
        "validate_action_packet",
      ]),
    );
    assert.equal(status.sequenceComplete, false);
    assert.equal(status.missingTool, "inspect_evidence");
    assert.ok(status.reason.includes("out of the required order"), status.reason);
    report("required tools out of order are incomplete");
  }

  // 4. Only the classification tool called -> incomplete.
  {
    const status = evaluateAgentCompletion(await collectSequence(["classify_issue"]));
    assert.equal(status.sequenceComplete, false);
    assert.equal(status.completedCount, 1);
    assert.equal(status.missingTool, "lookup_official_route");
    report("only classify_issue is incomplete");
  }

  // 6. validate_action_packet absent or rejected -> incomplete.
  {
    const missing = evaluateAgentCompletion(
      await collectSequence(["classify_issue", "lookup_official_route", "inspect_evidence"]),
    );
    assert.equal(missing.sequenceComplete, false);
    assert.equal(missing.missingTool, "validate_action_packet");
    assert.equal(missing.completedCount, 3);

    // Called, but never completed: the call is recorded while the tool's own
    // result record (proof of success) is not.
    const rejected = await collectSequence([
      "classify_issue",
      "lookup_official_route",
      "inspect_evidence",
    ]);
    rejected.toolsCalled.push("validate_action_packet");
    const rejectedStatus = evaluateAgentCompletion(rejected);
    assert.equal(rejectedStatus.sequenceComplete, false);
    assert.equal(rejectedStatus.missingTool, "validate_action_packet");
    assert.ok(rejectedStatus.reason.includes("did not complete"), rejectedStatus.reason);
    report("validate_action_packet absent or rejected is incomplete");
  }

  // 9. A real four-tool agent run -> complete, agentUsed true, summary usable.
  {
    const finalText = "Hermetic stub final summary of the consumer case.";
    let stubbedRequests = 0;
    const response = await withStubModel(
      (body) => {
        stubbedRequests += 1;
        const tool = nextRequiredTool(body);
        return tool ? sseToolCall(tool, STUB_TOOL_ARGS[tool]) : sseText(finalText);
      },
      () =>
        runHermeticTriage({
          description: CONSUMER_DESCRIPTION,
          workflow: "consumer_grievance",
          evidence: CONSUMER_EVIDENCE,
        }),
    );
    assert.equal(stubbedRequests, 5, "stub answers four tool turns plus one final turn");
    assert.equal(response.agentUsed, true);
    assert.equal(response.agentError, undefined);
    assert.equal(response.workflowResolved, "consumer_grievance");
    assert.equal(response.readiness.status, "ready");
    assert.equal(response.actionPacket?.issueSummary, finalText);
    report("four-tool agent run is complete and may use its summary");
  }

  // 8. Agent answers without calling any tool -> not an agent analysis.
  {
    const stubProse = "Hermetic stub prose that never called a tool.";
    const response = await withStubModel(
      () => sseText(stubProse),
      () =>
        runHermeticTriage({
          description: CONSUMER_DESCRIPTION,
          workflow: "consumer_grievance",
          evidence: CONSUMER_EVIDENCE,
        }),
    );
    assert.equal(response.agentUsed, false);
    assert.ok(response.agentError, "an incomplete agent run must be disclosed");
    assert.ok(
      response.agentError?.includes("did not complete the required tool sequence"),
      `unexpected agentError copy: ${response.agentError}`,
    );
    assert.equal(response.readiness.status, "ready");
    assert.equal(
      response.actionPacket?.issueSummary,
      "CivicTrail triaged the reported problem under the Consumer grievance workflow.",
    );
    report("agentUsed is false when no tool was called and prose is not authoritative");
  }

  // 7. Deterministic fallback still produces the rule-engine readiness.
  {
    process.env.GROQ_BASE_URL = "http://127.0.0.1:9/v1"; // discard port — refuses instantly
    const expected = computeReadiness({
      workflow: "cyber_financial_fraud",
      evidence: CASE_B_EVIDENCE,
    });
    const response = await runHermeticTriage({
      description: CASE_A_DESCRIPTION,
      workflow: "cyber_financial_fraud",
      evidence: CASE_B_EVIDENCE,
    });
    assert.equal(response.agentUsed, false);
    assert.ok(response.agentError, "fallback must be disclosed, not hidden");
    assert.ok(response.agentError?.includes("deterministic checks still applied"));
    assert.equal(response.readiness.status, expected.status);
    assert.equal(response.readiness.blockingCount, expected.blockingCount);
    assert.ok(response.readiness.findings.some((finding) => finding.status === "fail"));
    assert.ok(response.actionPacket, "a routed workflow still produces its action packet");
    assert.equal(
      response.actionPacket?.issueSummary,
      "CivicTrail triaged the reported problem under the Cyber financial fraud workflow.",
    );
    report("deterministic fallback keeps the rule-engine readiness");
  }

  // 5. Cancelled run (wall-clock deadline) -> incomplete and disclosed.
  {
    const server = createServer(() => {
      /* deliberately never responds — the deadline must fire */
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    process.env.GROQ_BASE_URL = `http://127.0.0.1:${port}/v1`;
    process.env.CIVICTRAIL_MODEL_TIMEOUT_MS = "2000";
    process.env.CIVICTRAIL_AGENT_DEADLINE_MS = "1500";

    const started = Date.now();
    const response = await runHermeticTriage({
      description: CASE_A_DESCRIPTION,
      workflow: "cyber_financial_fraud",
      evidence: CASE_A_EVIDENCE,
    });
    const elapsed = Date.now() - started;
    server.close();

    assert.ok(elapsed < 30_000, `deadline must bound the run, took ${elapsed}ms`);
    assert.equal(response.agentUsed, false);
    assert.ok(
      response.agentError?.includes("interactive time limit"),
      `unexpected agentError copy: ${response.agentError}`,
    );
    const expected = computeReadiness({
      workflow: "cyber_financial_fraud",
      evidence: CASE_A_EVIDENCE,
    });
    assert.equal(response.readiness.status, expected.status);
    report(`cancelled run is incomplete and disclosed (${elapsed}ms)`);
  }

  console.log(`${passed} agent completion tests passed`);
}

main().catch((error: unknown) => {
  console.error("agent completion tests FAILED");
  console.error(error);
  process.exitCode = 1;
});
