import { SectionVideo } from "./SectionVideo";

/* Cinematic hero background (remote asset; section falls back to #010828). */
const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_045634_e1c98c76-1265-4f5c-882a-4276f2080894.mp4";

export function Hero() {
  return (
    <section
      id="home"
      className="relative isolate flex min-h-screen items-center overflow-hidden bg-navy"
    >
      <SectionVideo src={HERO_VIDEO} />
      <div className="video-veil" aria-hidden="true" />
      {/* Pooled darkness directly behind the copy — this is what lets the
          global veil stay light enough to actually see the footage. */}
      <div className="ct-scrim" aria-hidden="true" />
      <div className="ct-atmos" aria-hidden="true" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24 pt-36 text-center">
        <p className="ct-hero-accent font-accent text-3xl font-medium text-neon sm:text-4xl">
          Follow the evidence
        </p>
        <h1 className="mx-auto mt-3 max-w-3xl font-display text-5xl uppercase leading-[1.05] tracking-wide text-cream sm:text-6xl lg:text-7xl">
          Turn a problem into an action-ready case.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl font-mono text-sm leading-6 text-cream/70">
          CivicTrail uses an AI agent to understand your problem, identify the official route, and
          check your evidence against deterministic rules — so you know exactly what is ready, what
          is missing, and what needs a human review. CivicTrail provides informational and workflow
          assistance, not legal advice.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#start-a-case"
            className="rounded-xl bg-neon px-8 py-4 font-display text-base uppercase tracking-widest text-navy shadow-[0_0_28px_rgba(111,255,0,0.35)] transition hover:brightness-110"
          >
            Start a case
          </a>
          <span className="liquid-glass rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cream/75">
            Evidence-first · Decision-support
          </span>
        </div>
        {/* Floating glass metadata chips — descriptive HUD labels only. */}
        <ul
          aria-label="What CivicTrail does"
          className="mt-10 flex flex-wrap items-center justify-center gap-2.5"
        >
          {["AI + Civic workflow", "Verified sources", "Deterministic checks", "Human confirmation"].map(
            (chip) => (
              <li key={chip} className="ct-chip">
                {chip}
              </li>
            ),
          )}
        </ul>
      </div>
      <div className="ct-section-edge ct-section-edge-bottom" aria-hidden="true" />
    </section>
  );
}
