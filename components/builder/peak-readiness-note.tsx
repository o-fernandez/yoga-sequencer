"use client";

import { useState } from "react";
import { getBodyTargetLabel } from "@/lib/poses";
import type { PeakReadiness } from "@/lib/peak-readiness";

/**
 * Calm, in-context readiness shown on the peak pose's own card: an affirmation
 * when the body is warmed, or a gentle note of what's still waking up with prep
 * ideas tucked behind a tap. Replaces the old standalone top panel.
 */
export function PeakReadinessNote({
  readiness,
  onAddPrep,
}: {
  readiness: PeakReadiness;
  onAddPrep: (poseName: string) => void;
}) {
  const { unwarmed, suggestionsByArea } = readiness;
  const [showPrep, setShowPrep] = useState(false);

  if (unwarmed.length === 0) {
    return (
      <p className="mt-2.5 font-display text-sm italic text-stone-500">
        The body is ready for this.
      </p>
    );
  }

  return (
    <div className="mt-2.5">
      <p className="text-xs text-stone-500">
        Still waking up:{" "}
        <span className="text-stone-700">
          {unwarmed.map((a) => getBodyTargetLabel(a)).join(", ")}
        </span>
      </p>
      <button
        type="button"
        onClick={() => setShowPrep((v) => !v)}
        className="mt-1 text-[11px] text-stone-400 transition hover:text-stone-600"
      >
        {showPrep ? "Hide prep ideas" : "Prep ideas →"}
      </button>

      {showPrep && (
        <div className="mt-2 space-y-2.5 border-t border-amber-200/40 pt-2.5">
          {suggestionsByArea.map(({ area, poses }) => (
            <div key={area}>
              <p className="mb-1 text-[11px] text-stone-400">
                Warm {getBodyTargetLabel(area)}
              </p>
              {poses.length === 0 ? (
                <p className="text-xs italic text-stone-400">No prep pose in the library</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {poses.map((pose) => (
                    <button
                      key={pose}
                      type="button"
                      onClick={() => onAddPrep(pose)}
                      className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white/70 px-2.5 py-1 text-[11px] text-stone-600 transition hover:border-stone-300 hover:bg-white hover:text-stone-800"
                    >
                      <span aria-hidden className="text-stone-400">+</span>
                      {pose}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
