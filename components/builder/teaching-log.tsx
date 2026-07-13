"use client";

import { useRef, useState } from "react";
import {
  localTodayISO,
  sortedTaughtEntries,
  sortedUpcomingEntries,
  type TeachEntry,
} from "@/lib/sequences";
import { formatShortDate } from "@/lib/format";

const REFLECTIVE_QUESTIONS = [
  "What happened that you didn't plan?",
  "What would you cut next time?",
  "Where did the time go?",
  "What landed for the room?",
  "What did you change in the moment?",
  "What do you want to remember for next time?",
  "What felt rushed, and what had space?",
  "Who was in the room today, and what did they need?",
];

function reflectivePlaceholder(date: string): string {
  const n = date.replace(/-/g, "").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return REFLECTIVE_QUESTIONS[n % REFLECTIVE_QUESTIONS.length];
}

function NoteEditor({
  initialValue,
  onSave,
  date,
}: {
  initialValue: string;
  onSave: (value: string) => void;
  date: string;
}) {
  const [draft, setDraft] = useState(initialValue);
  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onSave(draft)}
      placeholder={reflectivePlaceholder(date)}
      rows={3}
      className="mt-2 w-full resize-none rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300 focus:border-stone-400 focus:outline-none"
    />
  );
}

export function TeachingLog({
  dates,
  onChange,
}: {
  dates: TeachEntry[];
  onChange: (dates: TeachEntry[]) => void;
}) {
  const today = localTodayISO();
  const past = sortedTaughtEntries(dates);
  const upcoming = sortedUpcomingEntries(dates);
  const [addingEntry, setAddingEntry] = useState(false);
  const [entryDate, setEntryDate] = useState(today);
  const [entryNotes, setEntryNotes] = useState("");
  // Set true onMouseDown on Cancel so the form-level onBlur skips saving.
  // mousedown fires before blur, so the ref is readable when blur runs.
  const cancelingRef = useRef(false);

  const openForm = () => {
    setEntryDate(today);
    setEntryNotes("");
    cancelingRef.current = false;
    setAddingEntry(true);
  };

  const saveEntry = () => {
    if (entryDate && !dates.some((e) => e.date === entryDate)) {
      onChange([...dates, { date: entryDate, notes: entryNotes.trim() || undefined }]);
    }
    setAddingEntry(false);
  };

  const handleFormBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node) && !cancelingRef.current) {
      saveEntry();
    }
    cancelingRef.current = false;
  };

  const removeDate = (date: string) => {
    onChange(dates.filter((e) => e.date !== date));
  };

  const updateNotes = (date: string, notes: string) => {
    onChange(dates.map((e) => (e.date === date ? { ...e, notes: notes.trim() || undefined } : e)));
  };

  const renderEntry = (entry: TeachEntry) => (
    <div key={entry.date} className="rounded-xl border border-stone-200/60 bg-white/60 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-stone-700">{formatShortDate(entry.date)}</span>
        <button
          type="button"
          onClick={() => removeDate(entry.date)}
          className="text-xs text-stone-400 transition hover:text-red-400"
        >
          Remove
        </button>
      </div>
      <NoteEditor
        key={entry.date}
        initialValue={entry.notes ?? ""}
        onSave={(val) => updateNotes(entry.date, val)}
        date={entry.date}
      />
    </div>
  );

  return (
    <section className="mt-8">
      {/* Header */}
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <span className="font-display text-lg font-light tracking-tight text-stone-800">
          Teaching Log
        </span>
        {!addingEntry && (
          <button
            type="button"
            onClick={openForm}
            className="rounded-lg border border-stone-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-white hover:text-stone-800"
          >
            + Log a class
          </button>
        )}
      </div>

      {/* Log entry form */}
      <div className={addingEntry ? "mb-4" : ""}>
        {addingEntry ? (
          <div
            className="rounded-xl border border-stone-200 bg-white/80 px-4 py-3"
            onBlur={handleFormBlur}
          >
            <input
              type="date"
              value={entryDate}
              autoFocus
              onChange={(e) => setEntryDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { cancelingRef.current = true; setAddingEntry(false); }
              }}
              className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-700 focus:border-stone-400 focus:outline-none"
            />
            <textarea
              value={entryNotes}
              onChange={(e) => setEntryNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { cancelingRef.current = true; setAddingEntry(false); }
              }}
              placeholder={reflectivePlaceholder(entryDate)}
              rows={3}
              className="mt-2 w-full resize-none rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300 focus:border-stone-400 focus:outline-none"
            />
            <div className="mt-2">
              <button
                type="button"
                onMouseDown={() => { cancelingRef.current = true; }}
                onClick={() => setAddingEntry(false)}
                className="text-xs text-stone-400 transition hover:text-stone-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Entries — always visible */}
      <div className="space-y-4">
        {upcoming.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-stone-400">
              Upcoming
            </p>
            <div className="space-y-2">{upcoming.map(renderEntry)}</div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-stone-400">
              Past
            </p>
            <div className="space-y-2">{past.map(renderEntry)}</div>
          </div>
        )}

        {dates.length === 0 && !addingEntry && (
          <p className="text-sm text-stone-400">No entries yet.</p>
        )}
      </div>
    </section>
  );
}
