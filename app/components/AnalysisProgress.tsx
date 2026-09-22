import { useEffect, useState } from "react";

const STAGES = [
  "Case received",
  "Understanding the problem",
  "Checking official route",
  "Inspecting evidence",
  "Verifying readiness",
  "Preparing result",
];

/** Elapsed-time budget per stage for the visual estimate. */
const STAGE_INTERVAL_MS = 2000;
/** Progress shown immediately on submit: receipt is a client-side fact. */
const PROGRESS_INITIAL_PERCENT = 12;
/** The line eases toward this ceiling and never fakes completion. */
const PROGRESS_CEILING_PERCENT = 95;

function formatElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(1).padStart(4, "0")}s`;
}

/**
 * Analysis-in-progress panel shown while /api/triage is running.
 *
 * TRUTHFULNESS: the CivicTrail API returns a single verified result and does
 * not stream internal agent events, so this panel advances its stage markers
 * on elapsed time as a visual estimate only. It never claims that a specific
 * internal model or tool step has completed; the verified readiness result
 * appears the moment analysis actually finishes. No model chain-of-thought is
 * shown.
 *
 * Mounted only while loading is true. Unmounted the moment the real result
 * arrives or the request fails.
 */
export function AnalysisProgress() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  // While running, receipt (stage 0) is done immediately because submit already
  // happened locally; later stages advance on elapsed time only. The last stage
  // stays active until the real API response arrives, so we never fake full
  // completion.
  const doneCount = Math.min(STAGES.length - 1, 1 + Math.floor(elapsedMs / STAGE_INTERVAL_MS));
  const activeIndex = Math.min(doneCount, STAGES.length - 1);
  const progressPercent = Math.min(
    PROGRESS_CEILING_PERCENT,
    PROGRESS_INITIAL_PERCENT +
      (elapsedMs / (STAGES.length * STAGE_INTERVAL_MS)) *
        (PROGRESS_CEILING_PERCENT - PROGRESS_INITIAL_PERCENT),
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className="ct-console mt-6 rounded-2xl p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl uppercase tracking-wide text-cream">
          CivicTrail analysis
        </h3>
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-neon">
          Strands agent active
        </span>
      </div>

      <div
        className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/10"
        aria-hidden="true"
      >
        <div
          className="ct-progress-fill h-full rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <ol className="mt-4 space-y-2.5">
        {STAGES.map((stage, index) => {
          const state =
            index < activeIndex ? "done" : index === activeIndex ? "active" : "future";
          return (
            <li
              key={stage}
              aria-current={state === "active" ? "step" : undefined}
              className={`flex items-center gap-3 font-mono text-xs font-semibold uppercase tracking-wider transition-colors duration-500 ${
                state === "done"
                  ? "text-cream/80"
                  : state === "active"
                    ? "text-cream"
                    : "text-cream/40"
              }`}
            >
              {state === "done" ? (
                <span aria-hidden="true" className="text-neon">
                  ✓
                </span>
              ) : state === "active" ? (
                <span
                  aria-hidden="true"
                  className="ct-pulse inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-neon shadow-[0_0_10px_rgba(111,255,0,0.8)]"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-cream/30"
                />
              )}
              {stage}
              {state === "active" ? <span className="sr-only">(in progress)</span> : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-3">
        <span className="font-mono text-xs uppercase tracking-wider text-cream/70">Elapsed</span>
        <span className="font-mono text-sm font-bold tabular-nums text-neon">
          {formatElapsed(elapsedMs)}
        </span>
      </div>

      <p className="mt-2 font-mono text-[11px] leading-5 text-cream/55">
        Stage markers are an elapsed-time estimate, not live agent events — the verified
        readiness result appears as soon as analysis completes.
      </p>
    </div>
  );
}
