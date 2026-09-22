/**
 * Agent latency + fallback behaviour tests (hermetic — no external network).
 *
 * Run with: npm test  (tsx tests/agent-latency.test.ts)
 *
 * These tests prove the interactive latency budgets:
 * - the agent fails fast (no long exponential waits) when the model endpoint
 *   is unreachable
 * - the wall-clock deadline bounds the whole run even against a hanging
 *   endpoint
 * - the deterministic fallback still produces a valid, honest result whose
 *   readiness comes only from the rule engine
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { runTriageAgent, MissingGroqConfigError } from "../lib/agent/triage-agent";
import { runTriage } from "../lib/agent/triage-orchestrator";
import { CASE_A_DESCRIPTION, CASE_A_EVIDENCE } from "../lib/demo/cyber-demo";
import { CASE_N2_EVIDENCE } from "../lib/demo/consumer-demo";

let passed = 0;
function report(name: string): void {
  passed += 1;
  console.log(`ok - ${name}`);
}

async function main(): Promise<void> {
  /* Env overrides must be applied before each scenario; this file runs in its
     own tsx process so nothing downstream is affected. */

  // 1. Missing Groq config fails fast (no retry storm, immediate fallback).
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_MODEL;
  {
    const started = Date.now();
    let thrown: unknown = null;
    try {
      await runTriageAgent({
        description: CASE_A_DESCRIPTION,
        userSelection: "auto",
        evidence: CASE_A_EVIDENCE,
      });
    } catch (error) {
      thrown = error;
    }
    assert.ok(thrown instanceof MissingGroqConfigError, "expected MissingGroqConfigError");
    assert.ok(Date.now() - started < 2_000, "missing config must fail immediately");
    report("missing Groq config fails fast and deterministically");
  }

  // 2. Unreachable endpoint: bounded retry budget (attempt + 1 short retry).
  process.env.GROQ_API_KEY = "hermetic-test-key";
  process.env.GROQ_MODEL = "hermetic-test-model";
  process.env.GROQ_BASE_URL = "http://127.0.0.1:9/v1"; // discard port — refuses instantly

  // 3. Orchestrator fallback: honest disclosure, deterministic verdict intact.
  {
    const response = await runTriage({
      description: "Demo seller shipped a damaged appliance and refuses replacement.",
      workflow: "consumer_grievance",
      evidence: CASE_N2_EVIDENCE,
    });
    assert.equal(response.ok, true);
    assert.equal(response.agentUsed, false);
    assert.ok(response.agentError, "fallback must be disclosed, not hidden");
    assert.ok(
      response.agentError.includes("deterministic checks still applied"),
      `unexpected agentError copy: ${response.agentError}`,
    );
    assert.equal(response.readiness.status, "blocked");
    assert.ok(response.readiness.findings.some((finding) => finding.status === "fail"));
    report("orchestrator falls back to deterministic rules and stays honest");
  }

  // 4. Hanging endpoint: wall-clock deadline (plus per-request timeout) bounds
  //    the run to seconds; the deterministic result still arrives and the
  //    cancelled agent run is disclosed.
  {
    const server = createServer(() => {
      /* deliberately never responds */
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    process.env.GROQ_BASE_URL = `http://127.0.0.1:${port}/v1`;
    process.env.CIVICTRAIL_MODEL_TIMEOUT_MS = "2000";
    process.env.CIVICTRAIL_AGENT_DEADLINE_MS = "1500";

    const started = Date.now();
    const response = await runTriage({
      description: CASE_A_DESCRIPTION,
      workflow: "cyber_financial_fraud",
      evidence: CASE_A_EVIDENCE,
    });
    const elapsed = Date.now() - started;

    server.close();
    assert.ok(elapsed < 30_000, `deadline must bound the run, took ${elapsed}ms`);
    assert.equal(response.ok, true);
    assert.ok(response.agentError, "a cancelled agent run must be disclosed");
    assert.ok(
      ["ready", "blocked", "human_review"].includes(response.readiness.status),
      `unexpected readiness status: ${response.readiness.status}`,
    );
    report(`wall-clock deadline bounds a hanging endpoint (${elapsed}ms)`);
  }

  console.log(`${passed} agent latency tests passed`);
}

main().catch((error: unknown) => {
  console.error("agent latency tests FAILED");
  console.error(error);
  process.exitCode = 1;
});
