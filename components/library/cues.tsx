"use client";

import { useState } from "react";
import type { CueEntry } from "@/lib/cues";

export function CuesEmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-stone-300 bg-white/60 px-8 py-16 text-center">
      <p className="text-sm text-stone-500">Your cue library is empty.</p>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-stone-400">
        Every cue you write onto a pose is quietly kept here, in your own words —
        ready to reuse, or to vary when a pose comes back around.
      </p>
    </div>
  );
}

/** One remembered cue: the pose it was written for, tap the words to reword or remove. */
function CueRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: CueEntry;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.text);

  const startEditing = () => { setDraft(entry.text); setEditing(true); };
  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== entry.text) onEdit(entry.id, trimmed);
    setEditing(false);
  };

  return (
    <article className="rounded-2xl border border-stone-200/70 bg-white/70 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <p className="text-[11px] uppercase tracking-[0.15em] text-stone-400">{entry.pose}</p>
      {editing ? (
        <div className="mt-1.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
              if (e.key === "Escape") setEditing(false);
            }}
            rows={2}
            autoFocus
            className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[14px] leading-relaxed text-stone-800 focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200"
          />
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onDelete(entry.id)}
              className="text-[13px] text-rose-500 transition hover:text-rose-700"
            >
              Delete
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full px-3 py-1.5 text-[13px] font-medium text-stone-500 transition hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                className="rounded-full bg-stone-800 px-4 py-1.5 text-[13px] font-medium text-stone-100 transition hover:bg-stone-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="mt-1 block w-full text-left text-[14px] italic leading-relaxed text-stone-700 transition hover:text-stone-900"
        >
          {entry.text}
        </button>
      )}
    </article>
  );
}

export function CuesView({
  cues,
  query,
  onQueryChange,
  onEdit,
  onDelete,
}: {
  cues: CueEntry[];
  query: string;
  onQueryChange: (q: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? cues.filter(
        (c) => c.text.toLowerCase().includes(q) || c.pose.toLowerCase().includes(q),
      )
    : cues;

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search your cues…"
        className="mb-4 w-full rounded-full border border-stone-200 bg-white/70 px-4 py-2.5 text-[14px] text-stone-800 placeholder:text-stone-400 focus:border-stone-300 focus:outline-none focus:ring-2 focus:ring-stone-200"
      />
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-stone-400">
          No cues match &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <CueRow key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
