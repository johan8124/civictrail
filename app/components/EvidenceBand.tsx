import { SectionVideo } from "./SectionVideo";

/* Additional cinematic background for the evidence concept band. */
const EVIDENCE_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_053923_22c0a6a5-313c-474c-85ff-3b50d25e944a.mp4";

/**
 * Static explainer band for CivicTrail's actual output concepts
 * (Evidence Ledger, readiness verdicts, Action Pack). No fake data —
 * the verdict chips are a legend of the three real deterministic states.
 */
export function EvidenceBand() {
  return (
    <section id="evidence" className="relative isolate scroll-mt-24 overflow-hidden bg-navy py-24">
      <SectionVideo src={EVIDENCE_VIDEO} />
      <div className="video-veil" aria-hidden="true" />
      <div className="ct-atmos" aria-hidden="true" />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <p className="text-center font-accent text-2xl text-neon sm:text-3xl">Evidence-first</p>
        <h2 className="mt-2 text-center font-display text-4xl uppercase tracking-wide text-cream sm:text-5xl">
          Evidence, auditable
        </h2>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <div className="liquid-glass ct-panel ct-lift rounded-2xl p-6">
            <h3 className="font-display text-xl uppercase tracking-wide text-cream">
              The Evidence Ledger
            </h3>
            <p className="mt-3 font-mono text-xs leading-5 text-cream/70">
              Every check, its claim, source and status — fully auditable. Provenance is recorded
              for every deterministic result.
            </p>
          </div>
          <div className="liquid-glass ct-panel ct-lift rounded-2xl p-6">
            <h3 className="font-display text-xl uppercase tracking-wide text-cream">
              Readiness verdicts
            </h3>
            <ul className="mt-3 space-y-2">
              <li className="flex items-center gap-2">
                <span className="rounded border border-neon/50 bg-neon/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-neon">
                  Ready
                </span>
                <span className="font-mono text-xs text-cream/70">all deterministic checks pass</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="rounded border border-red-400/60 bg-red-400/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-red-300">
                  Blocked
                </span>
                <span className="font-mono text-xs text-cream/70">a required item is missing</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="rounded border border-amber-300/60 bg-amber-300/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-200">
                  Human review
                </span>
                <span className="font-mono text-xs text-cream/70">a human must decide next</span>
              </li>
            </ul>
          </div>
          <div className="liquid-glass ct-panel ct-lift rounded-2xl p-6">
            <h3 className="font-display text-xl uppercase tracking-wide text-cream">The Action Pack</h3>
            <p className="mt-3 font-mono text-xs leading-5 text-cream/70">
              Official route, evidence checklist, verified sources and next steps — always requiring
              human confirmation before anything is filed.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
