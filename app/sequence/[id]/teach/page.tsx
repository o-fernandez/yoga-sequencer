"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { loadSequence, formatBreathEstimate, sortedTaughtEntries, type SequenceRecord } from "@/lib/sequences";
import {
  buildTeachSteps,
  groupIntoPasses,
  totalTeachMinutes,
  type TeachPass,
} from "@/lib/teach";
import { formatMinutes } from "@/lib/format";
import { classAsText } from "@/lib/class-text";
import { copyTextToClipboard } from "@/lib/clipboard";

/** Round to nearest 5 min, formatted as "~30-min class structure". */
function approxClassTime(minutes: number): string {
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  return `~${rounded}-min class structure`;
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

function formatLastTimeDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function LastTimeNote({ sequence }: { sequence: SequenceRecord }) {
  const entry = sortedTaughtEntries(sequence.dates).find((e) => e.notes);
  if (!entry) return null;
  return (
    <div className="mb-8 border-l-2 border-stone-400/40 pl-4 print:hidden">
      <p className="mb-1 flex items-center gap-1.5 text-xs text-stone-400">
        <span aria-hidden>↺</span>
        Last time · {formatLastTimeDate(entry.date)}
      </p>
      <p className="text-base italic leading-relaxed text-stone-500">{entry.notes}</p>
    </div>
  );
}

function PoseRow({
  pose,
  sanskrit,
  duration,
  breaths,
  holdMode,
  cue,
  modifications,
  themePose,
  isPeak,
}: {
  pose: string;
  sanskrit?: string;
  duration: string;
  breaths?: number;
  holdMode?: boolean;
  cue?: string;
  modifications?: string[];
  themePose?: boolean;
  isPeak?: boolean;
}) {
  // Tap-to-reveal modification options, folded away by default so the running
  // order stays glanceable mid-class. Per-row state; nothing is saved.
  const [showOptions, setShowOptions] = useState(false);
  const options = modifications ?? [];
  const hasOptions = options.length > 0;
  const toggleOptions = () => setShowOptions((v) => !v);

  // Theme spine: a left-edge accent that lets the teacher scan the through-line
  // of the class — a thin rail on theme poses, a stronger block on the peak.
  return (
    <li
      className={`relative py-5 pl-5 print:break-inside-avoid print:py-1.5 print:pl-0 ${hasOptions ? "cursor-pointer" : ""}`}
      onClick={hasOptions ? toggleOptions : undefined}
    >
      {(themePose || isPeak) && (
        <span
          aria-hidden
          className={`absolute left-0 top-4 bottom-4 rounded-full print:hidden ${
            isPeak ? "w-1.5 bg-amber-500" : "w-1 bg-amber-300/70"
          }`}
        />
      )}
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-2xl font-medium leading-snug text-stone-900 print:text-sm">
          {pose}
          {sanskrit && (
            <span className="ml-2 text-base font-normal italic text-stone-400 print:text-[11px]">
              {sanskrit}
            </span>
          )}
          {isPeak && (
            <span className="ml-2 align-middle text-[11px] font-medium uppercase tracking-[0.18em] text-amber-600/80 print:text-[9px]">
              peak
            </span>
          )}
        </h3>
        {breaths !== undefined ? (
          <div className="shrink-0 text-right">
            <p className="text-base tabular-nums text-stone-700 print:text-xs">
              {breaths} breath{breaths === 1 ? "" : "s"}
            </p>
            <p className="text-sm tabular-nums text-stone-400 print:hidden">
              {formatBreathEstimate(breaths, holdMode ?? false)}
            </p>
          </div>
        ) : (
          <span className="shrink-0 text-base tabular-nums text-stone-500 print:text-xs">
            {duration}
          </span>
        )}
      </div>
      {cue && (
        <p className="mt-2 text-lg leading-relaxed text-stone-600 print:mt-0.5 print:text-xs">{cue}</p>
      )}
      {hasOptions && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleOptions(); }}
            aria-expanded={showOptions}
            className="mt-2 text-xs text-stone-400 transition hover:text-stone-600 print:hidden"
          >
            {showOptions
              ? "Hide options"
              : `${options.length} option${options.length === 1 ? "" : "s"} →`}
          </button>
          {showOptions && (
            <ul className="mt-1.5 space-y-1.5 border-l-2 border-stone-400/40 pl-3.5 print:hidden">
              {options.map((option) => (
                <li key={option} className="text-base leading-relaxed text-stone-600">
                  {option}
                </li>
              ))}
            </ul>
          )}
        </>
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
    <div className="mb-8 flex flex-wrap gap-1.5 print:hidden">
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

function RunningOrder({ passes, peakPose }: { passes: TeachPass[]; peakPose?: string }) {
  return (
    <div className="space-y-10 print:space-y-4">
      {passes.map((pass) => (
        <section key={pass.id}>
          <div className="sticky top-[64px] z-10 -mx-6 flex items-baseline justify-between gap-4 bg-[#e8e3da]/95 px-6 py-3 backdrop-blur-sm print:static print:mx-0 print:bg-transparent print:px-0 print:py-1 print:backdrop-blur-none print:break-after-avoid">
            <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-stone-500 print:text-[11px]">
              {pass.sectionTitle}
              {pass.sideLabel && (
                <span className="ml-2 normal-case tracking-normal text-stone-400">
                  · {pass.sideLabel}
                </span>
              )}
            </h2>
            <span className="shrink-0 text-xs tabular-nums text-stone-400 print:text-[10px]">
              {formatMinutes(pass.minutes)}
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
                modifications={step.modifications}
                themePose={step.themePose}
                isPeak={Boolean(peakPose) && step.pose === peakPose}
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
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const editHref = `/sequence/${id}`;

  useWakeLock();

  const handleCopy = async () => {
    if (!sequence) return;
    const ok = await copyTextToClipboard(classAsText(sequence));
    setCopyState(ok ? "copied" : "failed");
    setTimeout(() => setCopyState("idle"), 2000);
  };

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
    <div className="min-h-screen bg-[#e8e3da] text-stone-800 print:bg-white">
      <main className="mx-auto w-full max-w-2xl px-6 pb-24 print:pb-0">
        {/* Share actions / Done — chrome only, never printed */}
        <div className="sticky top-0 z-20 -mx-6 flex items-center justify-between bg-[#e8e3da]/95 px-6 py-4 backdrop-blur-sm print:hidden">
          <div className="flex items-center gap-2 text-[13px] text-stone-400">
            {sequence && !isEmpty && (
              <>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="transition hover:text-stone-600"
                >
                  {copyState === "copied"
                    ? "Copied"
                    : copyState === "failed"
                      ? "Couldn't copy"
                      : "Copy as text"}
                </button>
                <span aria-hidden className="text-stone-300">·</span>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="transition hover:text-stone-600"
                >
                  Print
                </button>
              </>
            )}
          </div>
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
            <header className="border-b border-stone-300/50 pb-8 pt-2 print:pb-3 print:pt-0">
              <h1 className="text-4xl font-light leading-tight tracking-tight text-stone-900 print:text-2xl">
                {sequence.name}
              </h1>
              {sequence.theme && (
                <p className="mt-2 text-lg italic text-stone-500 print:mt-1 print:text-sm">{sequence.theme}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-stone-500 print:mt-2 print:text-xs">
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
                <LastTimeNote sequence={sequence} />
                <SectionStrip passes={passes} />
                <RunningOrder passes={passes} peakPose={sequence.peakPose} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
