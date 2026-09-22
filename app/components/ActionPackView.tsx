import type { ActionPacket } from "@/lib/types/civictrail";

export function ActionPackView({ packet }: { packet: ActionPacket }) {
  return (
    <section className="ct-card rounded-xl">
      <div className="flex flex-wrap items-center border-b border-white/10 px-5 py-4">
        <div>
          <h3 className="font-display text-sm uppercase tracking-wide text-cream">Action Pack</h3>
          <p className="mt-0.5 font-mono text-xs text-cream/55">Packet {packet.packetId}</p>
        </div>
        <span className="ml-auto rounded-full border border-amber-300/50 bg-[rgba(255,190,80,0.15)] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wide text-[#FFDFAC]">
          Requires human confirmation
        </span>
      </div>

      {/* #20: the human-confirmation requirement is a first-class amber notice,
          not a tiny chip. Amber semantics (a review flag, NOT an error), kept
          directly under the Action Pack title/status. */}
      <div role="note" className="border-b border-amber-300/40 bg-[rgba(255,190,80,0.14)] px-5 py-3">
        <p className="flex items-center gap-2 text-sm font-bold text-[#FFDFAC]">
          <span aria-hidden="true" className="text-base leading-none">
            ✋
          </span>
          Requires human confirmation
        </p>
        <p className="mt-1 font-mono text-xs leading-5 text-[#FFDFA8]/90">
          CivicTrail never submits anything automatically — a human must review and confirm
          every action before it is taken.
        </p>
      </div>

      <div className="grid gap-6 px-5 py-5 md:grid-cols-2">
        <div>
          <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-cream/55">
            Issue summary
          </h4>
          <p className="mt-2 font-mono text-sm leading-6 text-cream/85">{packet.issueSummary}</p>

          <h4 className="mt-5 font-mono text-[11px] font-bold uppercase tracking-widest text-neon">
            Official route
          </h4>
          <p className="mt-2 font-display text-xl uppercase tracking-wide text-cream">
            {packet.route.label}
          </p>
          <p className="mt-0.5 font-mono text-xs text-cream/55">{packet.route.jurisdiction}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-xs leading-5 text-cream/70">
            {packet.route.verifiedGuidance.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>

          <h4 className="mt-5 font-mono text-[11px] font-bold uppercase tracking-wider text-cream/55">
            Next actions
          </h4>
          <ul className="mt-2 list-decimal space-y-1 pl-5 font-mono text-xs leading-5 text-cream/75">
            {packet.nextActions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-cream/55">
            Evidence checklist
          </h4>
          <ul className="mt-2 space-y-1 font-mono text-xs leading-5">
            {packet.evidenceIndex.map((item) => (
              <li key={item.field} className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${item.provided ? "bg-neon" : "bg-red-400"}`}
                  aria-hidden="true"
                />
                <span className={item.provided ? "text-cream/85" : "text-cream/55"}>
                  {item.label}
                </span>
                <span className="ml-auto text-[10px] text-cream/60">{item.requirementKind}</span>
              </li>
            ))}
          </ul>

          <h4 className="mt-5 font-mono text-[11px] font-bold uppercase tracking-wider text-cream/55">
            Source references (verified)
          </h4>
          <ul className="mt-2 space-y-2 font-mono text-xs leading-5">
            {packet.sourceReferences.map((source) => (
              <li key={source.sourceId}>
                <a
                  className="font-semibold text-neon underline-offset-2 hover:underline"
                  href={source.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.name}
                </a>
                <span className="ct-tag mt-0.5">{source.jurisdiction} · official source</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 px-5 py-3">
        <p className="font-mono text-[11px] leading-5 text-cream/55">{packet.disclaimer}</p>
      </div>
    </section>
  );
}
