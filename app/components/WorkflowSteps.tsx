import { SectionVideo } from "./SectionVideo";

/* Secondary cinematic background for the "How CivicTrail works" section. */
const WORKFLOW_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_151551_992053d1-3d3e-4b8c-abac-45f22158f411.mp4";

const STEPS = [
  { n: 1, title: "Tell us what happened", detail: "Describe the problem in your own words." },
  { n: 2, title: "Identify the official route", detail: "The agent maps it to a verified official process." },
  { n: 3, title: "Check your evidence", detail: "Deterministic rules check each required item." },
  { n: 4, title: "Verify readiness", detail: "READY, BLOCKED, or HUMAN REVIEW — never a guess." },
  { n: 5, title: "Review your Action Pack", detail: "A packet with sources, checklist and next steps." },
];

export function WorkflowSteps() {
  return (
    <section id="how-it-works" className="relative isolate scroll-mt-24 overflow-hidden bg-navy py-24">
      <SectionVideo src={WORKFLOW_VIDEO} />
      <div className="video-veil" aria-hidden="true" />
      <div className="ct-atmos" aria-hidden="true" />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <p className="text-center font-accent text-2xl text-neon sm:text-3xl">Follow the evidence</p>
        <h2 className="mt-2 text-center font-display text-4xl uppercase tracking-wide text-cream sm:text-5xl">
          How CivicTrail works
        </h2>
        <div className="relative">
          {/* Connective signal line: threads the five steps into one sequence
              (visible in the gaps between the glass cards, behind them). */}
          <div
            aria-hidden="true"
            className="ct-signal absolute left-[6%] right-[6%] top-[5.4rem] hidden h-px lg:block"
          />
          <ol className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((step) => (
              <li key={step.n} className="liquid-glass ct-panel ct-lift rounded-2xl p-5">
                <div className="ct-step-index">{String(step.n).padStart(2, "0")}</div>
                <div className="mt-3 font-display text-base uppercase tracking-wide text-cream">
                  {step.title}
                </div>
                <div className="mt-2 font-mono text-xs leading-5 text-cream/65">{step.detail}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="ct-section-edge ct-section-edge-bottom" aria-hidden="true" />
    </section>
  );
}
