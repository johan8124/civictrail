import type { TriageResponse } from "@/lib/types/civictrail";

/* Semantic status treatments on the dark visual system — every status also
   carries readable text, never color alone. */
const BANNER_STYLES: Record<string, { label: string; cls: string }> = {
  ready: {
    label: "READY",
    cls: "border-[rgba(111,255,0,0.45)] bg-[rgba(111,255,0,0.08)] text-[#CFFF9E]",
  },
  blocked: {
    label: "BLOCKED",
    cls: "border-[rgba(255,90,110,0.5)] bg-[rgba(255,90,110,0.08)] text-[#FFC2C8]",
  },
  human_review: {
    label: "HUMAN REVIEW",
    cls: "border-[rgba(255,190,80,0.5)] bg-[rgba(255,190,80,0.08)] text-[#FFDFAC]",
  },
};

export function ReadinessBanner({ result }: { result: TriageResponse }) {
  const banner = BANNER_STYLES[result.readiness.status] ?? BANNER_STYLES.human_review;
  const passingCount = result.readiness.ledger.filter((entry) => entry.status === "pass").length;
  const isHumanReview = result.readiness.status === "human_review";
  const noPacket = isHumanReview && !result.actionPacket;
  return (
    <div className={`rounded-xl border p-5 ${banner.cls}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-md bg-black/30 px-3 py-1 font-display text-lg tracking-wide">
          {banner.label}
        </span>
        <span className="font-mono text-sm font-semibold">
          {result.readiness.blockingCount} blocking · {result.readiness.reviewCount} for review ·{" "}
          {passingCount} passing
        </span>
        <span className="ml-auto text-xs font-medium">
          Determined by deterministic rule results — the agent cannot override this.
        </span>
      </div>
      {result.readiness.status === "blocked" ? (
        <p className="mt-2 text-sm font-semibold">
          Blocked by deterministic rules. The failing rule IDs are listed in the Evidence Ledger
          below.
        </p>
      ) : null}
      {result.agentError ? (
        <p className="mt-2 rounded-lg border border-amber-300/40 bg-[rgba(255,190,80,0.12)] px-3 py-2 font-mono text-xs font-medium leading-5 text-[#FFDFA8]">
          {result.agentError}
        </p>
      ) : null}
      {result.classificationGuard ? (
        <p className="mt-2 font-mono text-xs leading-5">
          <span className="font-semibold uppercase tracking-wide">
            {result.classificationGuard.outcome === "accepted"
              ? "Classification accepted by deterministic guard:"
              : "Classification guard downgraded suggestion to HUMAN_REVIEW:"}
          </span>{" "}
          <span className="font-medium">{result.classificationGuard.reason}</span>
        </p>
      ) : null}
      {noPacket ? (
        <p className="mt-2 rounded-md bg-black/30 px-3 py-2 text-sm font-semibold text-cream">
          No Action Pack was generated — this case requires human confirmation first. Resolve the
          review items in the Evidence Ledger, then check readiness again.
        </p>
      ) : null}
      {result.agentSummary ? (
        <p className="mt-3 font-mono text-sm leading-6 text-cream/90">{result.agentSummary}</p>
      ) : null}
    </div>
  );
}
