import type { LedgerEntry } from "@/lib/types/civictrail";

const STATUS_STYLES: Record<string, string> = {
  pass: "bg-[rgba(111,255,0,0.16)] text-[#C6FF8F]",
  fail: "bg-[rgba(255,90,110,0.22)] text-[#FFB9C0]",
  review: "bg-[rgba(255,190,80,0.2)] text-[#FFDFA8]",
  info: "bg-white/10 text-cream/80",
};

export function EvidenceLedgerView({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) return null;
  const failed = entries.filter((entry) => entry.status === "fail");
  return (
    <section className="ct-card rounded-xl">
      <div className="border-b border-white/10 px-5 py-4">
        <h3 className="font-display text-sm uppercase tracking-wide text-cream">Evidence Ledger</h3>
        <p className="mt-0.5 font-mono text-xs text-cream/55">
          Every check, its claim, source and status — fully auditable.
        </p>
      </div>
      {failed.length > 0 ? (
        <div className="border-b border-red-400/40 bg-[rgba(255,90,110,0.12)] px-5 py-3 text-xs text-[#FFC2C8]">
          <span className="font-semibold uppercase tracking-wide">Blocked by rule(s):</span>{" "}
          <span className="font-mono text-sm font-bold text-[#FF8A97]">
            {failed.map((entry) => entry.ruleId).join(", ")}
          </span>
        </div>
      ) : null}
      <ul className="divide-y divide-white/10">
        {entries.map((entry) => (
          <li key={entry.id} className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${STATUS_STYLES[entry.status] ?? STATUS_STYLES.info}`}
              >
                {entry.status}
              </span>
              <span className="text-sm font-medium text-cream">{entry.claim}</span>
              <span
                className={`ml-auto font-mono text-[11px] ${
                  entry.status === "fail" ? "font-bold text-[#FF8A97]" : "text-cream/60"
                }`}
              >
                {entry.ruleId ?? "—"} · confidence {entry.confidence.toFixed(2)}
              </span>
            </div>
            <div className="mt-2 font-mono text-xs leading-5 text-cream/75">{entry.evidence}</div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="ct-tag">source: {entry.source}</span>
              <span className="ct-tag">ref: {entry.reference}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
