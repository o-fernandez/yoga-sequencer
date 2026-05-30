"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    return [...seq.dates.map((e) => e.date)].sort().at(-1)!;
  }
  return seq.updatedAt;
}

/**
 * Press-and-hold to long-press, plain tap to click. Distinguishes the two using
 * pointer events so it works for both touch and mouse, and cancels on scroll.
 */
function useLongPress(onLongPress: () => void, onClick: () => void, ms = 450) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const moved = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      moved.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!origin.current) return;
      const dx = Math.abs(e.clientX - origin.current.x);
      const dy = Math.abs(e.clientY - origin.current.y);
      if (dx > 10 || dy > 10) {
        moved.current = true;
        clearTimer();
      }
    },
    onPointerUp: () => {
      clearTimer();
      if (!fired.current && !moved.current) onClick();
    },
    onPointerLeave: clearTimer,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

function SelectIndicator({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
        selected
          ? "border-stone-800 bg-stone-800 text-white"
          : "border-stone-300 bg-white"
      }`}
    >
      {selected && (
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
          <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
        </svg>
      )}
    </span>
  );
}

function SequenceCard({
  sequence,
  selectionMode,
  selected,
  onOpen,
  onToggleSelect,
  onEnterSelection,
  onDuplicate,
  onDelete,
}: {
  sequence: SequenceRecord;
  selectionMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
  onEnterSelection: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const poseCount = totalPoses(sequence);
  const today = new Date().toISOString().slice(0, 10);
  const taughtDates = (sequence.dates ?? []).filter((e) => e.date <= today);
  const plannedDates = (sequence.dates ?? []).filter((e) => e.date > today).sort((a, b) => a.date.localeCompare(b.date));
  const nextPlanned = plannedDates[0]?.date;
  const lastTaught = [...taughtDates].sort((a, b) => b.date.localeCompare(a.date))[0]?.date;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handlers = useLongPress(
    onEnterSelection,
    () => (selectionMode ? onToggleSelect() : onOpen()),
  );

  return (
    <article
      role="button"
      tabIndex={0}
      aria-pressed={selectionMode ? selected : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (selectionMode) onToggleSelect();
          else onOpen();
        }
      }}
      {...handlers}
      className={`cursor-pointer select-none touch-pan-y rounded-2xl border bg-white/70 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] backdrop-blur-sm transition [-webkit-touch-callout:none] hover:bg-white/80 hover:shadow-[0_2px_8px_rgba(0,0,0,0.07)] ${
        selected
          ? "border-stone-400 ring-2 ring-stone-400/60"
          : "border-stone-300/40"
      }`}
    >
      <div className="flex items-start gap-3">
        {selectionMode && <SelectIndicator selected={selected} />}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-medium text-stone-900">
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
        </div>
        {!selectionMode && (
          <div
            ref={menuRef}
            className="relative shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              aria-label={`More actions for ${sequence.name}`}
              aria-expanded={menuOpen}
              className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <path d="M4 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm5 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-9 z-20 w-36 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDuplicate(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-stone-700 transition hover:bg-stone-50"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(); setMenuOpen(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function SelectionBar({
  count,
  onDuplicate,
  onDelete,
  onCancel,
}: {
  count: number;
  onDuplicate: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-stone-300 bg-white/95 px-2 py-2 shadow-lg backdrop-blur-sm">
      <span className="whitespace-nowrap px-3 text-sm font-medium text-stone-600">
        {count} selected
      </span>
      <button
        type="button"
        onClick={onDuplicate}
        className="rounded-full px-4 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-[#e8e3da] hover:text-stone-800"
      >
        Duplicate
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-full px-4 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
      >
        Delete
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel selection"
        className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
      >
        ✕
      </button>
    </div>
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
  const router = useRouter();
  const [sequences, setSequences] = useState<SequenceRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectionMode = selectedIds.size > 0;

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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterSelection = (id: string) => {
    setSelectedIds((prev) => new Set(prev).add(id));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleDeleteSelected = () => {
    selectedIds.forEach((id) => deleteSequence(id));
    setSequences((prev) => prev.filter((s) => !selectedIds.has(s.id)));
    clearSelection();
  };

  const handleDuplicateSelected = () => {
    // Duplicate in display order so the copies land together at the top.
    const copies: SequenceRecord[] = [];
    sequences
      .filter((s) => selectedIds.has(s.id))
      .forEach((s) => {
        const copy = duplicateSequence(s.id);
        if (copy) copies.push(copy);
      });
    if (copies.length) setSequences((prev) => [...copies.reverse(), ...prev]);
    clearSelection();
  };

  const handleDuplicateOne = useCallback((id: string) => {
    const copy = duplicateSequence(id);
    if (copy) setSequences((prev) => [copy, ...prev]);
  }, []);

  const handleDeleteOne = useCallback((id: string) => {
    deleteSequence(id);
    setSequences((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return (
    <div className="min-h-screen bg-[#e8e3da] px-6 py-12 text-stone-800">
      <main className="mx-auto w-full max-w-2xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Yoga Flow</p>
            <h1 className="mt-2 text-4xl font-light tracking-tight text-stone-900">
              Your Sequences
            </h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:mt-3">
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
          <>
            {selectionMode && (
              <p className="mb-3 text-xs text-stone-400">
                Tap to select · press and hold any card to start
              </p>
            )}
            <div className="space-y-3">
              {sequences.map((seq) => (
                <SequenceCard
                  key={seq.id}
                  sequence={seq}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(seq.id)}
                  onOpen={() => router.push(`/sequence/${seq.id}`)}
                  onToggleSelect={() => toggleSelect(seq.id)}
                  onEnterSelection={() => enterSelection(seq.id)}
                  onDuplicate={() => handleDuplicateOne(seq.id)}
                  onDelete={() => handleDeleteOne(seq.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {selectionMode && (
        <SelectionBar
          count={selectedIds.size}
          onDuplicate={handleDuplicateSelected}
          onDelete={handleDeleteSelected}
          onCancel={clearSelection}
        />
      )}
    </div>
  );
}
