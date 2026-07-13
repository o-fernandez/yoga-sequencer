"use client";

import { useEffect, useState } from "react";
import { cuesForPose, type CueEntry } from "@/lib/cues";

export function PoseCueField({
  cue,
  onSave,
  compact = false,
}: {
  cue?: string;
  onSave: (cue: string) => void;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEditing = () => {
    setDraft(cue ?? "");
    setEditing(true);
  };
  const save = () => {
    onSave(draft.trim());
    setEditing(false);
  };
  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") cancel();
        }}
        placeholder="Teaching cue…"
        autoFocus
        className={`mt-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-stone-700 placeholder:text-stone-400 focus:border-stone-400 focus:outline-none ${
          compact ? "text-xs" : "text-sm"
        }`}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (cue) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); startEditing(); }}
        className={`mt-1.5 block text-left italic text-stone-500 hover:text-stone-600 ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        {cue}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); startEditing(); }}
      className="mt-1.5 text-xs text-stone-400 hover:text-stone-600"
    >
      Add cue
    </button>
  );
}

/**
 * Past cues the teacher has written for this same pose — so a repeat in a later
 * round can be varied instead of repeated. Tapping one drops it into the cue.
 * Stays silent unless there's a different past wording to offer.
 */
export function PoseCueSuggestions({
  pose,
  currentCue,
  onApply,
}: {
  pose: string;
  currentCue?: string;
  onApply: (text: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<CueEntry[]>([]);

  useEffect(() => {
    const current = (currentCue ?? "").trim().toLowerCase();
    setSuggestions(
      cuesForPose(pose)
        .filter((c) => c.text.trim().toLowerCase() !== current)
        .slice(0, 4),
    );
  }, [pose, currentCue]);

  if (suggestions.length === 0) return null;

  return (
    <div className="mt-2.5">
      <p className="font-display text-[11px] italic text-stone-400">
        You&rsquo;ve cued this before
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {suggestions.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={(e) => { e.stopPropagation(); onApply(c.text); }}
            title="Use this cue"
            className="max-w-full truncate rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-left text-[11px] italic text-stone-500 transition hover:border-stone-300 hover:bg-white hover:text-stone-700"
          >
            {c.text}
          </button>
        ))}
      </div>
    </div>
  );
}
