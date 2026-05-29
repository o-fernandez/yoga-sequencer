"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  loadSequences,
  deleteSequence,
  duplicateSequence,
  type SequenceRecord,
} from "@/lib/sequences";

function formatDate(iso: string): string {
  // Parse as local noon to avoid timezone off-by-one
  const d = new Date(`${iso}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-US", opts);
}

function totalPoses(seq: SequenceRecord): number {
  return seq.sections.reduce((sum, s) => sum + s.poses.length, 0);
}

/** Max date from a sequence's dates array; falls back to updatedAt for sorting. */
function sortKey(seq: SequenceRecord): string {
  if (seq.dates && seq.dates.length > 0) {
    return [...seq.dates].sort().at(-1)!;
  }
  return seq.updatedAt;
}

function SequenceCard({
  sequence,
  onDuplicate,
  onDelete,
}: {
  sequence: SequenceRecord;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const poseCount = totalPoses(sequence);
  const today = new Date().toISOString().slice(0, 10);
  const allDates = [...(sequence.dates ?? [])].sort();
  const taughtDates = allDates.filter((d) => d <= today);
  const plannedDates = allDates.filter((d) => d > today);
  const nextPlanned = plannedDates[0];    // earliest future date
  const lastTaught = taughtDates.at(-1); // most recent past date

  return (
    <article className="rounded-2xl border border-stone-300/40 bg-white/70 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] backdrop-blur-sm transition hover:bg-white/80 hover:shadow-[0_2px_8px_rgba(0,0,0,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <Link
          href={`/sequence/${sequence.id}`}
          className="group min-w-0 flex-1"
        >
          <h2 className="truncate text-base font-medium text-stone-900 group-hover:text-stone-700">
            {sequence.name}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {sequence.theme && (
              <p className="text-sm italic text-stone-500">{sequence.theme}</p>
            )}
            {sequence.peakPose && (
              <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs text-stone-600">
                <span aria-hidden className="text-stone-400">↑</span>
                {sequence.peakPose}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-stone-400">
            <span>{poseCount} pose{poseCount === 1 ? "" : "s"}</span>
            {taughtDates.length > 0 && (
              <span>Taught {taughtDates.length}×</span>
            )}
            {nextPlanned ? (
              <span className="text-stone-500">Next {formatDate(nextPlanned)}</span>
            ) : lastTaught ? (
              <span>{formatDate(lastTaught)}</span>
            ) : null}
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`/sequence/${sequence.id}`}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-[#e8e3da] hover:text-stone-800"
          >
            Open
          </Link>
          <button
            type="button"
            onClick={onDuplicate}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-500 transition hover:bg-[#e8e3da] hover:text-stone-700"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-stone-400 transition hover:bg-red-50 hover:text-red-600"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-stone-300 bg-white/60 px-8 py-16 text-center">
      <p className="text-sm text-stone-500">No sequences yet.</p>
      <Link
        href="/sequence/new"
        className="mt-4 inline-block rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50"
      >
        Create your first sequence
      </Link>
    </div>
  );
}

export default function LibraryPage() {
  const [sequences, setSequences] = useState<SequenceRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const reload = () => {
      const all = loadSequences();
      setSequences([...all].sort((a, b) => sortKey(b).localeCompare(sortKey(a))));
      setLoaded(true);
    };
    reload();
    // Re-read when the tab regains focus (catches back-navigation from router cache)
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, []);

  const handleDuplicate = (id: string) => {
    const copy = duplicateSequence(id);
    if (copy) setSequences((prev) => [copy, ...prev]);
  };

  const handleDelete = (id: string) => {
    deleteSequence(id);
    setSequences((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#e8e3da] px-6 py-12 text-stone-800">
      <main className="mx-auto w-full max-w-2xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Yoga Flow</p>
            <h1 className="mt-2 text-4xl font-light tracking-tight text-stone-900">
              Your Sequences
            </h1>
          </div>
          <div className="mt-3 flex shrink-0 items-center gap-2">
            <Link
              href="/quick-entry"
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50"
            >
              Quick entry
            </Link>
            <Link
              href="/sequence/new"
              className="rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-stone-100 shadow-sm transition hover:bg-stone-700"
            >
              + New sequence
            </Link>
          </div>
        </header>

        {!loaded ? (
          <div className="py-16 text-center text-sm text-stone-400">Loading…</div>
        ) : sequences.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {sequences.map((seq) => (
              <SequenceCard
                key={seq.id}
                sequence={seq}
                onDuplicate={() => handleDuplicate(seq.id)}
                onDelete={() => handleDelete(seq.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
