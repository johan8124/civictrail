import { SectionVideo } from "./SectionVideo";

/* Final cinematic background for the closing disclaimer section. */
const FINAL_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_055729_72d66327-b59e-4ae9-bb70-de6ccb5ecdb0.mp4";

export function Disclaimer() {
  return (
    <footer id="about" className="relative isolate scroll-mt-24 overflow-hidden bg-navy">
      <SectionVideo src={FINAL_VIDEO} />
      <div className="video-veil" aria-hidden="true" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="liquid-glass ct-panel rounded-2xl px-6 py-5">
          <p className="font-mono text-xs leading-5 text-cream/70">
            CivicTrail provides informational and workflow assistance, not legal advice or legal
            representation. Verify official requirements before taking action. All user input and
            evidence is treated as untrusted and is never executed. Nothing is ever submitted to a
            government service automatically.
          </p>
        </div>
      </div>
    </footer>
  );
}
