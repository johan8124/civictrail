"use client";

import { useState } from "react";
import type { EvidenceRecord, TriageResponse } from "@/lib/types/civictrail";
import {
  CASE_A_DESCRIPTION,
  CASE_B_EVIDENCE,
  CASE_C_EVIDENCE,
  CASE_D_EVIDENCE,
  CASE_E_DESCRIPTION,
  CASE_F_DESCRIPTION,
  CASE_A_EVIDENCE,
} from "@/lib/demo/cyber-demo";
import { ReadinessBanner } from "./ReadinessBanner";
import { EvidenceLedgerView } from "./EvidenceLedgerView";
import { ActionPackView } from "./ActionPackView";
import { AnalysisProgress } from "./AnalysisProgress";
import {
  CASE_N1_EVIDENCE,
  CASE_N2_EVIDENCE,
  CASE_E1_EVIDENCE,
  CASE_G_DESCRIPTION,
} from "@/lib/demo/consumer-demo";

type WorkflowChoice = "auto" | "consumer_grievance" | "cyber_financial_fraud";

type IntakeField = {
  key: keyof EvidenceRecord;
  label: string;
  placeholder: string;
  /** Minimum rendered rows: 3 for long-form fields, 1 for short values. */
  minRows: number;
  /** Long-form fields span the full form width so long values stay inspectable. */
  wide?: boolean;
  /**
   * Short structured values use a single-line control instead of a textarea:
   * "text" renders a one-line input (numeric input mode for the 12-digit UTR),
   * "date" renders a native date input (values stay "yyyy-mm-dd", matching the
   * existing presence-based validation). Undefined keeps the textarea.
   */
  control?: "text" | "date";
};

const CYBER_FIELDS: IntakeField[] = [
  { key: "incidentDateTime", label: "Incident date/time", placeholder: "e.g. 2026-09-10 14:32 IST", minRows: 1 },
  { key: "incidentDetails", label: "Incident details", placeholder: "What happened, how you were contacted...", minRows: 3, wide: true },
  { key: "identityDocument", label: "Identity document (metadata)", placeholder: "e.g. government photo ID available (do not paste full ID numbers)", minRows: 1 },
  { key: "bankWalletMerchant", label: "Bank / wallet / merchant", placeholder: "Which bank, wallet or merchant was involved", minRows: 1 },
  { key: "transactionId", label: "12-digit transaction ID / UTR", placeholder: "12-digit number from your statement", minRows: 1, control: "text" },
  { key: "transactionDate", label: "Transaction date", placeholder: "e.g. 2026-09-10", minRows: 1, control: "date" },
  { key: "fraudAmount", label: "Fraud amount", placeholder: "e.g. 24999", minRows: 1 },
  { key: "supportingEvidence", label: "Supporting evidence (metadata)", placeholder: "e.g. screenshots available", minRows: 1 },
];

const CONSUMER_FIELDS: IntakeField[] = [
  { key: "problemDescription", label: "Problem description", placeholder: "What went wrong", minRows: 3, wide: true },
  { key: "sellerOrProvider", label: "Seller or service provider", placeholder: "Who you bought from", minRows: 1 },
  { key: "purchaseEvidence", label: "Purchase evidence (metadata)", placeholder: "e.g. order id / invoice reference", minRows: 1 },
  { key: "paymentEvidence", label: "Payment evidence (metadata)", placeholder: "e.g. payment reference", minRows: 1 },
  { key: "consumerRouteRequested", label: "Consumer route you are preparing for", placeholder: "Leave as \"not sure\" if undecided", minRows: 1 },
  { key: "notarizedAffidavit", label: "Notarized affidavit (e-Jagriti only)", placeholder: "e-Jagriti only: confirm signed notarized affidavit is available", minRows: 1 },
];

/** Enough rows that a value is fully visible — long values are never truncated. */
function rowsFor(value: string, minRows: number): number {
  return Math.min(10, Math.max(minRows, Math.ceil(value.length / 70)));
}

export function CaseIntake() {
  const [description, setDescription] = useState("");
  const [workflow, setWorkflow] = useState<WorkflowChoice>("auto");
  const [evidence, setEvidence] = useState<EvidenceRecord>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TriageResponse | null>(null);
  const [demo, setDemo] = useState<{ mode: DemoMode; label: string } | null>(null);

  const isConsumer = workflow === "consumer_grievance";
  const fields = isConsumer ? CONSUMER_FIELDS : CYBER_FIELDS;

  function setField(key: keyof EvidenceRecord, value: string) {
    setEvidence((prev) => ({ ...prev, [key]: value }));
  }

  type DemoMode =
    | "ready"
    | "utr"
    | "short"
    | "prohibited"
    | "municipal"
    | "ambiguous"
    | "consumer_nch"
    | "consumer_ejagriti"
    | "consumer_blocked"
    | "consumer_review";

  type DemoOutcome = "ready" | "blocked" | "review";

  const DEMO_MODES: Array<{ mode: DemoMode; label: string; outcome: DemoOutcome }> = [
    { mode: "ready", label: "Load synthetic demo (READY)", outcome: "ready" },
    { mode: "utr", label: "Invalid UTR (BLOCKED)", outcome: "blocked" },
    { mode: "short", label: "Short details (BLOCKED)", outcome: "blocked" },
    { mode: "prohibited", label: "Prohibited characters (BLOCKED)", outcome: "blocked" },
    { mode: "municipal", label: "Municipal tax (HUMAN_REVIEW)", outcome: "review" },
    { mode: "ambiguous", label: "Ambiguous case (HUMAN_REVIEW)", outcome: "review" },
    { mode: "consumer_nch", label: "Consumer NCH demo (READY)", outcome: "ready" },
    { mode: "consumer_ejagriti", label: "Consumer e-Jagriti demo (READY)", outcome: "ready" },
    { mode: "consumer_blocked", label: "Consumer missing evidence (BLOCKED)", outcome: "blocked" },
    { mode: "consumer_review", label: "Consumer ambiguous (HUMAN_REVIEW)", outcome: "review" },
  ];

  /* Button colors follow the Design.md status palette: restrained green for
     READY, restrained red for BLOCKED, restrained amber for HUMAN_REVIEW —
     and the outcome is also written in the label text, never color alone. */
  const DEMO_BUTTON_STYLES: Record<DemoOutcome, string> = {
    ready: "border-neon/50 bg-neon/10 text-neon hover:bg-neon/20",
    blocked: "border-red-400/60 bg-red-400/10 text-red-300 hover:bg-red-400/20",
    review: "border-amber-300/60 bg-amber-300/10 text-amber-200 hover:bg-amber-300/20",
  };

  function loadDemo(mode: DemoMode) {
    const label = DEMO_MODES.find((d) => d.mode === mode)?.label ?? mode;
    switch (mode) {
      case "ready":
        setDescription(CASE_A_DESCRIPTION);
        setWorkflow("cyber_financial_fraud");
        setEvidence(CASE_A_EVIDENCE);
        break;
      case "utr":
        setDescription(CASE_A_DESCRIPTION);
        setWorkflow("cyber_financial_fraud");
        setEvidence(CASE_B_EVIDENCE);
        break;
      case "short":
        setDescription(CASE_A_DESCRIPTION);
        setWorkflow("cyber_financial_fraud");
        setEvidence(CASE_C_EVIDENCE);
        break;
      case "prohibited":
        setDescription(CASE_A_DESCRIPTION);
        setWorkflow("cyber_financial_fraud");
        setEvidence(CASE_D_EVIDENCE);
        break;
      case "municipal":
        setDescription(CASE_E_DESCRIPTION);
        setWorkflow("auto");
        setEvidence({});
        break;
      case "ambiguous":
        setDescription(CASE_F_DESCRIPTION);
        setWorkflow("auto");
        setEvidence({});
        break;
      case "consumer_nch":
        setDescription(String(CASE_N1_EVIDENCE.problemDescription ?? ""));
        setWorkflow("consumer_grievance");
        setEvidence(CASE_N1_EVIDENCE);
        break;
      case "consumer_ejagriti":
        setDescription(String(CASE_E1_EVIDENCE.problemDescription ?? ""));
        setWorkflow("consumer_grievance");
        setEvidence(CASE_E1_EVIDENCE);
        break;
      case "consumer_blocked":
        setDescription(String(CASE_N2_EVIDENCE.problemDescription ?? ""));
        setWorkflow("consumer_grievance");
        setEvidence(CASE_N2_EVIDENCE);
        break;
      case "consumer_review":
        setDescription(CASE_G_DESCRIPTION);
        setWorkflow("consumer_grievance");
        setEvidence({});
        break;
    }
    setDemo({ mode, label });
    setResult(null);
    setError(null);
  }
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, workflow, evidence }),
      });
      const data: unknown = await response.json();
      if (!response.ok || typeof data !== "object" || data === null || !("readiness" in data)) {
        setError(
          typeof data === "object" && data !== null && "error" in data
            ? String((data as { error: unknown }).error)
            : "Triage request failed.",
        );
        return;
      }
      setResult(data as TriageResponse);
    } catch {
      setError("Could not reach the CivicTrail triage service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="start-a-case" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-4 pb-24 pt-20 sm:px-6">
      <div className="ct-hud-grid" aria-hidden="true" />
      <form
        onSubmit={handleSubmit}
        className="ct-console rounded-2xl p-5 sm:p-8"
      >
        <h2 className="font-display text-3xl uppercase tracking-wide text-cream sm:text-4xl">Start a case</h2>
        <p className="mt-2 font-mono text-xs leading-5 text-cream/60">
          Describe what happened. The Strands agent classifies it and looks up the official route;
          deterministic rules check your evidence.
        </p>

        {demo ? (
          <div role="status" className="mt-4 rounded-xl border border-neon/40 bg-[rgba(111,255,0,0.07)] px-4 py-3">
            <p className="text-sm font-bold text-neon">
              Synthetic demo case — no real personal data.
            </p>
            <p className="mt-1 text-xs leading-5 text-cream/75">
              <span aria-hidden="true">✓ </span>
              Demo case loaded: <span className="font-semibold">{demo.label}</span>. All fields below
              are prefilled — bright cream text is the loaded value; dim italic text is only
              placeholder guidance.
            </p>
          </div>
        ) : null}

        <label
          htmlFor="what-happened"
          className="mt-5 block text-xs font-semibold uppercase tracking-wider text-cream/85"
        >
          What happened?
        </label>
        <textarea
          id="what-happened"
          className="ct-input mt-2 w-full p-3 text-sm font-medium leading-6 field-sizing-content"
          rows={Math.min(12, Math.max(4, Math.ceil(description.length / 90)))}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the problem in your own words..."
          required
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label
            htmlFor="workflow-choice"
            className="text-xs font-semibold uppercase tracking-wider text-cream/85"
          >
            Workflow
          </label>
          <select
            id="workflow-choice"
            className="ct-input rounded-xl px-3 py-2 text-sm font-medium"
            value={workflow}
            onChange={(e) => setWorkflow(e.target.value as WorkflowChoice)}
          >
            <option value="auto">Auto — let the agent classify</option>
            <option value="cyber_financial_fraud">Cyber financial fraud</option>
            <option value="consumer_grievance">Consumer grievance</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-cream/60">
            Synthetic demo cases:
          </span>
          {DEMO_MODES.map(({ mode, label, outcome }) => (
            <button
              key={mode}
              type="button"
              aria-pressed={demo?.mode === mode}
              onClick={() => loadDemo(mode)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                DEMO_BUTTON_STYLES[outcome]
              } ${demo?.mode === mode ? "ring-2 ring-neon ring-offset-2 ring-offset-[#010828]" : ""}`}
            >
              {/* Outcome dot (#17 light scanability aid): the outcome is still
                  written in the label text — color is never the only signal. */}
              <span
                aria-hidden="true"
                className={`inline-block h-1.5 w-1.5 flex-none rounded-full ${
                  outcome === "ready" ? "bg-neon" : outcome === "blocked" ? "bg-red-400" : "bg-amber-300"
                }`}
              />
              {label}
            </button>
          ))}
        </div>

        {workflow !== "consumer_grievance" ? (
          <p className="mt-2 font-mono text-[11px] leading-5 text-cream/60">
            Cyber financial fraud fields mirror the official complainant checklist on
            cybercrime.gov.in. If the agent classifies differently, only matching rules are
            evaluated.
          </p>
        ) : (
          <p className="mt-2 font-mono text-[11px] leading-5 text-cream/60">
            These are CivicTrail product intake requirements (civictrail_intake_requirement), not
            claims about legally mandatory filing requirements.
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((field) => {
            const value = (evidence[field.key] as string | undefined) ?? "";
            const hasValue = value.trim().length > 0;
            const fieldId = `intake-${String(field.key)}`;
            return (
              <div key={String(field.key)} className={field.wide ? "sm:col-span-2" : undefined}>
                <label
                  htmlFor={fieldId}
                  className="block text-xs font-semibold uppercase tracking-wide text-cream/85"
                >
                  {field.label}
                </label>
                {field.control === "text" ? (
                  <input
                    id={fieldId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className={`ct-input mt-1 w-full px-3 py-2 text-sm ${
                      hasValue ? "ct-input-filled font-medium" : ""
                    }`}
                    value={value}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                ) : field.control === "date" ? (
                  <input
                    id={fieldId}
                    type="date"
                    autoComplete="off"
                    className={`ct-input mt-1 w-full px-3 py-2 text-sm ${
                      hasValue ? "ct-input-filled font-medium" : ""
                    }`}
                    value={value}
                    onChange={(e) => setField(field.key, e.target.value)}
                  />
                ) : (
                  <textarea
                    id={fieldId}
                    rows={rowsFor(value, field.minRows)}
                    className={`ct-input mt-1 w-full resize-y px-3 py-2 text-sm leading-6 field-sizing-content ${
                      hasValue ? "ct-input-filled font-medium" : ""
                    }`}
                    value={value}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                  />
                )}
              </div>
            );
          })}
        </div>

        <button
          type="submit"
          disabled={loading || description.trim().length === 0}
          className="mt-6 w-full rounded-xl bg-neon px-6 py-3 font-display text-sm uppercase tracking-widest text-navy transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          {loading ? "Triaging…" : "Check readiness"}
        </button>
      </form>

      {error ? (
        <div className="ct-card mt-6 rounded-xl p-4 text-sm text-[#FFC9CE]">
          {error}
        </div>
      ) : null}

      {loading ? <AnalysisProgress /> : null}

      {result ? (
        <div className="mt-6 space-y-6">
          <div
            role="status"
            className="ct-fade-in flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-neon/30 bg-[rgba(111,255,0,0.06)] px-4 py-3"
          >
            <span aria-hidden="true" className="font-mono text-sm font-bold text-neon">✓</span>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-neon">
              Analysis complete
            </span>
            <span className="font-mono text-xs text-cream/70">
              — verified readiness result below
            </span>
          </div>
          <ReadinessBanner result={result} />
          <EvidenceLedgerView entries={result.readiness.ledger} />
          {result.actionPacket ? <ActionPackView packet={result.actionPacket} /> : null}
        </div>
      ) : null}
    </section>
  );
}
