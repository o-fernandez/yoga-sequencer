"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { loadSequence, formatBreathEstimate, type SequenceRecord } from "@/lib/sequences";
import {
  buildTeachSteps,
  groupIntoPasses,
  totalTeachMinutes,
  type TeachPass,
} from "@/lib/teach";

/** Round to nearest 5 min, formatted as "~30-min class structure". */
function approxClassTime(minutes: number): string {
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  return `~${rounded}-min class structure`;
}

function formatPassMinutes(minutes: number) {
  const whole = Math.floor(minutes);
  const secs = Math.round((minutes - whole) * 60);
  if (secs === 0) return `${whole} min`;
  if (whole === 0) return `${secs} sec`;
  return `${whole} min ${secs} sec`;
}

/** Keep the screen awake while the teach view is open; release on leave. */
function useWakeLock() {
  useEffect(() => {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let released = false;

    const acquire = async () => {
      try {
        sentinel = await nav.wakeLock!.request("screen");
      } catch {
        // User gesture / permission / power-save can reject — nothing to do.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !released) acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      sentinel?.release().catch(() => {});
    };
  }, []);
}

type WakeLockSentinelLike = { release: () => Promise<void> };

function PoseRow({
  pose,
  sanskrit,
  duration,
  breaths,
  holdMode,
  cue,
}: {
  pose: string;
  sanskrit?: string;
  duration: string;
  breaths?: number;
  holdMode?: boolean;
  cue?: string;
}) {
  return (
    <li className="py-5">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-2xl font-medium leading-snug text-stone-900">
          {pose}
          {sanskrit && (
            <span className="ml-2 text-base font-normal italic text-stone-400">
              {sanskrit}
            </span>
          )}
        </h3>
        {breaths !== undefined ? (
          <div className="shrink-0 text-right">
            <p className="text-base tabular-nums text-stone-700">
              {breaths} breath{breaths === 1 ? "" : "s"}
            </p>
            <p className="text-sm tabular-nums text-stone-400">
              {formatBreathEstimate(breaths, holdMode ?? false)}
            </p>
          </div>
        ) : (
          <span className="shrink-0 text-base tabular-nums text-stone-500">
            {duration}
          </span>
        )}
      </div>
      {cue && (
        <p className="mt-2 text-lg leading-relaxed text-stone-600">{cue}</p>
      )}
    </li>
  );
}

function SectionStrip({ passes }: { passes: TeachPass[] }) {
  const sections = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const pass of passes) {
      if (!seen.has(pass.sectionTitle)) {
        seen.add(pass.sectionTitle);
        result.push(pass.sectionTitle);
      }
    }
    return result;
  }, [passes]);

  if (sections.length === 0) return null;

  return (
    <div className="mb-8 flex flex-wrap gap-1.5">
      {sections.map((title, i) => (
        <span key={title} className="flex items-center gap-1.5">
          <span className="rounded-full border border-stone-300/70 bg-white/60 px-3 py-1 text-sm text-stone-600">
            {title}
          </span>
          {i < sections.length - 1 && (
            <span className="text-stone-300 text-xs" aria-hidden>›</span>
          )}
        </span>
      ))}
    </div>
  );
}

function RunningOrder({ passes }: { passes: TeachPass[] }) {
  return (
    <div className="space-y-10">
      {passes.map((pass) => (
        <section key={pass.id}>
          <div className="sticky top-[64px] z-10 -mx-6 flex items-baseline justify-between gap-4 bg-[#e8e3da]/95 px-6 py-3 backdrop-blur-sm">
            <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-stone-500">
              {pass.sectionTitle}
              {pass.sideLabel && (
                <span className="ml-2 normal-case tracking-normal text-stone-400">
                  · {pass.sideLabel}
                </span>
              )}
            </h2>
            <span className="shrink-0 text-xs tabular-nums text-stone-400">
              {formatPassMinutes(pass.minutes)}
            </span>
          </div>
          <ul className="divide-y divide-stone-300/40">
            {pass.steps.map((step) => (
              <PoseRow
                key={step.id}
                pose={step.pose}
                sanskrit={step.sanskrit}
                duration={step.duration}
                breaths={step.breaths}
                holdMode={step.holdMode}
                cue={step.cue}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function TeachPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [sequence, setSequence] = useState<SequenceRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const editHref = `/sequence/${id}`;

  useWakeLock();

  useEffect(() => {
    // Hydrates client-only sequence state from browser storage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSequence(loadSequence(id));
    setLoaded(true);
  }, [id]);

  const { passes, totalMinutes } = useMemo(() => {
    const steps = sequence ? buildTeachSteps(sequence.sections) : [];
    return {
      passes: groupIntoPasses(steps),
      totalMinutes: totalTeachMinutes(steps),
    };
  }, [sequence]);

  const isEmpty = loaded && passes.length === 0;

  return (
    <div className="min-h-screen bg-[#e8e3da] text-stone-800">
      <main className="mx-auto w-full max-w-2xl px-6 pb-24">
        {/* Done / back to builder */}
        <div className="sticky top-0 z-20 -mx-6 flex items-center justify-end bg-[#e8e3da]/95 px-6 py-4 backdrop-blur-sm">
          <Link
            href={editHref}
            className="rounded-full border border-stone-300 bg-white/80 px-5 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-white"
          >
            Done
          </Link>
        </div>

        {!loaded ? (
          <div className="py-24 text-center text-sm text-stone-400">Loading…</div>
        ) : !sequence ? (
          <div className="py-24 text-center">
            <p className="text-stone-500">Sequence not found.</p>
            <Link href="/" className="mt-4 inline-block text-sm text-stone-600 underline-offset-2 hover:underline">
              Back to library
            </Link>
          </div>
        ) : (
          <>
            {/* Title card */}
            <header className="border-b border-stone-300/50 pb-8 pt-2">
              <h1 className="text-4xl font-light leading-tight tracking-tight text-stone-900">
                {sequence.name}
              </h1>
              {sequence.theme && (
                <p className="mt-2 text-lg italic text-stone-500">{sequence.theme}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-stone-500">
                {sequence.peakPose && (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="text-stone-400">↑</span>
                    Peak · {sequence.peakPose}
                  </span>
                )}
                {!isEmpty && (
                  <span>{approxClassTime(totalMinutes)}</span>
                )}
              </div>
            </header>

            {isEmpty ? (
              <div className="py-24 text-center">
                <p className="text-stone-500">This sequence has no poses yet.</p>
                <Link
                  href={editHref}
                  className="mt-4 inline-block text-sm text-stone-600 underline-offset-2 hover:underline"
                >
                  Add some in the builder
                </Link>
              </div>
            ) : (
              <div className="mt-8">
                <SectionStrip passes={passes} />
                <RunningOrder passes={passes} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
