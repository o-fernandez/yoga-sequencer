"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  loadSequences,
  deleteSequence,
  duplicateSequence,
  dismissExamplesNotice,
  examplesNoticeDismissed,
  generateId,
  isExampleSequence,
  removeExampleSequences,
  resetSequencesToSeeds,
  restoreSequence,
  saveSequence,
  type SequenceRecord,
} from "@/lib/sequences";
import {
  loadInspirations,
  deleteInspiration,
  isExampleInspiration,
  removeExampleInspirations,
  resetInspirationsToSeeds,
  type InspirationEntry,
} from "@/lib/inspirations";
import { allCues, updateCue, deleteCue, type CueEntry } from "@/lib/cues";
import { filterSequences } from "@/lib/library-search";
import { subscribeSyncApplied } from "@/lib/sync";
import { TeachingAheadStrip, upcomingTeachingItems } from "@/components/library/teaching-ahead";
import { SequenceCard } from "@/components/library/sequence-card";
import {
  InspirationCard,
  InspirationSheet,
  InspirationsEmptyState,
} from "@/components/library/inspirations";
import { CuesView, CuesEmptyState } from "@/components/library/cues";
import { useImportBackup } from "@/components/library/import-backup";
import {
  ExamplesNotice,
  RemoveExamplesModal,
  StartOverModal,
} from "@/components/library/examples";
import { SelectionBar, UndoToast } from "@/components/library/action-bars";
import { DataFooter } from "@/components/library/data-footer";

/** Max date from a sequence's dates array; falls back to updatedAt for sorting. */
function sortKey(seq: SequenceRecord): string {
  if (seq.dates && seq.dates.length > 0) {
    return [...seq.dates.map((e) => e.date)].sort().at(-1)!;
  }
  return seq.updatedAt;
}

function EmptyState({ onRestore }: { onRestore: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-stone-300 bg-white/60 px-8 py-16 text-center">
      <p className="text-sm text-stone-500">No classes yet.</p>
      <Link
        href="/sequence/new"
        className="mt-4 inline-block rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50"
      >
        Plan your first class
      </Link>
      <p className="mt-3 text-[13px] text-stone-400">
        or{" "}
        <button
          type="button"
          onClick={onRestore}
          className="underline underline-offset-2 transition hover:text-stone-600"
        >
          restore from a backup
        </button>
      </p>
    </div>
  );
}

export default function LibraryPage() {
  const router = useRouter();
  const [sequences, setSequences] = useState<SequenceRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"classes" | "inspirations" | "cues">("classes");
  const [inspirations, setInspirations] = useState<InspirationEntry[]>([]);
  const [cues, setCues] = useState<CueEntry[]>([]);
  const [cueQuery, setCueQuery] = useState("");
  const [classQuery, setClassQuery] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [editingInspiration, setEditingInspiration] = useState<InspirationEntry | null>(null);
  const [removeExamplesOpen, setRemoveExamplesOpen] = useState(false);
  const [startOverOpen, setStartOverOpen] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(true);
  // Classes just deleted and still undoable (the toast is up).
  const [undoIds, setUndoIds] = useState<string[]>([]);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectionMode = selectedIds.size > 0;
  const upcoming = upcomingTeachingItems(sequences);
  // Search narrows the class list; the ahead-strip and notices step aside while it's active.
  const searching = classQuery.trim() !== "";
  const visibleSequences = filterSequences(sequences, classQuery);
  const exampleClassCount = sequences.filter((s) => isExampleSequence(s.id)).length;
  const exampleInspirationCount = inspirations.filter((e) => isExampleInspiration(e.id)).length;
  // Work worth protecting: anything the teacher made themselves. Examples don't count.
  const hasOwnWork =
    sequences.some((s) => !isExampleSequence(s.id)) ||
    inspirations.some((e) => !isExampleInspiration(e.id)) ||
    cues.length > 0;

  useEffect(() => {
    const reload = () => {
      const all = loadSequences();
      setSequences([...all].sort((a, b) => sortKey(b).localeCompare(sortKey(a))));
      setInspirations(
        [...loadInspirations()].sort((a, b) => b.date.localeCompare(a.date))
      );
      setCues(allCues());
      setNoticeDismissed(examplesNoticeDismissed());
      setLoaded(true);
    };
    reload();
    // Re-read when the tab regains focus (catches back-navigation from router cache)
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, []);

  const reloadInspirations = useCallback(() => {
    setInspirations(
      [...loadInspirations()].sort((a, b) => b.date.localeCompare(a.date))
    );
  }, []);

  const handleCueEdited = useCallback((id: string, text: string) => {
    updateCue(id, text);
    setCues(allCues());
  }, []);

  const handleCueDeleted = useCallback((id: string) => {
    deleteCue(id);
    setCues((prev) => prev.filter((c) => c.id !== id));
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

  // Deletes are tombstones, so "undo" is cheap: remember the ids just deleted
  // and offer one tap back. Rapid successive deletes accumulate into one toast.
  const showUndoToast = useCallback((ids: string[]) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoIds((prev) => [...new Set([...prev, ...ids])]);
    undoTimerRef.current = setTimeout(() => setUndoIds([]), 8000);
  }, []);

  const handleUndoDelete = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoIds.forEach(restoreSequence);
    setUndoIds([]);
    reloadSequences();
  };

  const dismissUndoToast = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoIds([]);
  };

  useEffect(
    () => () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    },
    []
  );

  const handleDeleteSelected = () => {
    const ids = [...selectedIds];
    ids.forEach((id) => deleteSequence(id));
    setSequences((prev) => prev.filter((s) => !selectedIds.has(s.id)));
    clearSelection();
    showUndoToast(ids);
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
    showUndoToast([id]);
  }, [showUndoToast]);

  const reloadSequences = useCallback(() => {
    const all = loadSequences();
    setSequences([...all].sort((a, b) => sortKey(b).localeCompare(sortKey(a))));
  }, []);

  // A sync pull can land data from another device at any time — re-read the lists.
  useEffect(
    () =>
      subscribeSyncApplied(() => {
        reloadSequences();
        reloadInspirations();
        setCues(allCues());
      }),
    [reloadSequences, reloadInspirations]
  );

  const handleInspirationSaved = useCallback((saved: InspirationEntry) => {
    setInspirations((prev) => {
      const without = prev.filter((e) => e.id !== saved.id);
      return [saved, ...without].sort((a, b) => b.date.localeCompare(a.date));
    });
    setCaptureOpen(false);
    setEditingInspiration(null);
  }, []);

  const handleInspirationDeleted = useCallback((id: string) => {
    deleteInspiration(id);
    setInspirations((prev) => prev.filter((e) => e.id !== id));
    setEditingInspiration(null);
  }, []);

  const importer = useImportBackup(() => {
    reloadSequences();
    reloadInspirations();
  });

  const handleStartClassFromInspiration = useCallback((entry: InspirationEntry) => {
    const now = new Date().toISOString();
    const noteBody = entry.source
      ? `${entry.note.trim()}\n\n— from ${entry.source}`
      : entry.note.trim();
    const id = generateId();
    saveSequence({
      id,
      name: "",
      notes: noteBody,
      dates: [],
      createdAt: now,
      updatedAt: now,
      sections: [{ id: generateId(), title: "New section", secondSide: false, poses: [] }],
    });
    router.push(`/sequence/${id}`);
  }, [router]);

  const handleRemoveExamples = () => {
    removeExampleSequences();
    removeExampleInspirations();
    reloadSequences();
    reloadInspirations();
    setRemoveExamplesOpen(false);
  };

  const handleDismissNotice = () => {
    dismissExamplesNotice();
    setNoticeDismissed(true);
  };

  const handleStartOver = () => {
    resetSequencesToSeeds();
    resetInspirationsToSeeds();
    reloadSequences();
    reloadInspirations();
    clearSelection();
    setNoticeDismissed(false);
    setStartOverOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#e8e3da] px-6 py-12 text-stone-800">
      <main className="mx-auto w-full max-w-2xl">
        <header className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Yoga Flow</p>
              <h1 className="mt-2 text-4xl font-light tracking-tight text-stone-900">
                Library
              </h1>
            </div>
            <div className="mt-3 flex shrink-0 items-center">
              {activeTab === "classes" ? (
                <Link
                  href="/sequence/new"
                  className="rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-stone-100 shadow-sm transition hover:bg-stone-700"
                >
                  + New class
                </Link>
              ) : activeTab === "inspirations" ? (
                <button
                  type="button"
                  onClick={() => setCaptureOpen(true)}
                  className="rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-stone-100 shadow-sm transition hover:bg-stone-700"
                >
                  + New inspiration
                </button>
              ) : null}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-5 flex gap-1 rounded-full border border-stone-200 bg-stone-100/60 p-1 w-fit">
            {(
              [
                ["classes", "Classes"],
                ["inspirations", "Inspirations"],
                ["cues", "Cues"],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setActiveTab(tab); clearSelection(); }}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  activeTab === tab
                    ? "bg-white text-stone-800 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {!loaded ? (
          <div className="py-16 text-center text-sm text-stone-400">Loading…</div>
        ) : activeTab === "classes" ? (
          sequences.length === 0 ? (
            <EmptyState onRestore={importer.openPicker} />
          ) : (
            <>
              <input
                type="search"
                value={classQuery}
                onChange={(e) => setClassQuery(e.target.value)}
                placeholder="Search your classes…"
                className="mb-5 w-full rounded-full border border-stone-200 bg-white/70 px-4 py-2.5 text-[14px] text-stone-800 placeholder:text-stone-400 focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200"
              />
              {upcoming.length > 0 && !selectionMode && !searching && (
                <TeachingAheadStrip
                  items={upcoming}
                  onOpen={(id) => router.push(`/sequence/${id}`)}
                />
              )}
              {exampleClassCount > 0 && !selectionMode && !noticeDismissed && !searching && (
                <ExamplesNotice
                  onRemove={() => setRemoveExamplesOpen(true)}
                  onDismiss={handleDismissNotice}
                />
              )}
              {selectionMode && (
                <p className="mb-3 text-xs text-stone-400">
                  Tap to select · press and hold any card to start
                </p>
              )}
              {searching && visibleSequences.length === 0 ? (
                <p className="py-12 text-center text-sm text-stone-400">
                  No classes match &ldquo;{classQuery.trim()}&rdquo;.
                </p>
              ) : (
                <div className="space-y-3">
                  {visibleSequences.map((seq) => (
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
              )}
            </>
          )
        ) : activeTab === "inspirations" ? (
          inspirations.length === 0 ? (
            <InspirationsEmptyState onNew={() => setCaptureOpen(true)} />
          ) : (
            <div className="space-y-3">
              {inspirations.map((entry) => (
                <InspirationCard
                  key={entry.id}
                  entry={entry}
                  onOpen={() => setEditingInspiration(entry)}
                  onStartClass={() => handleStartClassFromInspiration(entry)}
                />
              ))}
            </div>
          )
        ) : cues.length === 0 ? (
          <CuesEmptyState />
        ) : (
          <CuesView
            cues={cues}
            query={cueQuery}
            onQueryChange={setCueQuery}
            onEdit={handleCueEdited}
            onDelete={handleCueDeleted}
          />
        )}

        {loaded && activeTab === "classes" && (
          <DataFooter
            onImport={importer.openPicker}
            importError={importer.error}
            onStartOver={() => setStartOverOpen(true)}
            hasOwnWork={hasOwnWork}
          />
        )}
      </main>

      {importer.elements}

      {removeExamplesOpen && (
        <RemoveExamplesModal
          classCount={exampleClassCount}
          inspirationCount={exampleInspirationCount}
          onConfirm={handleRemoveExamples}
          onCancel={() => setRemoveExamplesOpen(false)}
        />
      )}

      {startOverOpen && (
        <StartOverModal
          ownClassCount={sequences.length - exampleClassCount}
          ownInspirationCount={inspirations.length - exampleInspirationCount}
          onConfirm={handleStartOver}
          onCancel={() => setStartOverOpen(false)}
        />
      )}

      {selectionMode && (
        <SelectionBar
          count={selectedIds.size}
          onDuplicate={handleDuplicateSelected}
          onDelete={handleDeleteSelected}
          onCancel={clearSelection}
        />
      )}

      {undoIds.length > 0 && !selectionMode && (
        <UndoToast
          message={undoIds.length === 1 ? "Class deleted" : `${undoIds.length} classes deleted`}
          onUndo={handleUndoDelete}
          onDismiss={dismissUndoToast}
        />
      )}

      {captureOpen && (
        <InspirationSheet
          onSave={handleInspirationSaved}
          onClose={() => setCaptureOpen(false)}
        />
      )}

      {editingInspiration && (
        <InspirationSheet
          entry={editingInspiration}
          onSave={handleInspirationSaved}
          onDelete={() => handleInspirationDeleted(editingInspiration.id)}
          onClose={() => setEditingInspiration(null)}
        />
      )}
    </div>
  );
}
