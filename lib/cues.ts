import { generateId } from "./sequences";
import { emitDataChanged } from "./data-changed";
import { withoutExpiredTombstones } from "./sync-merge";

/**
 * A cue the teacher has written, kept for reuse. The library fills itself from
 * the cues written onto poses — there is no separate "save" step. An entry is a
 * snapshot that lives independently of any class: editing or removing it here
 * never touches the cues already written into saved classes.
 */
export type CueEntry = {
  id: string;
  /** The pose the cue was first written for — the only (automatic) grouping. */
  pose: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  /** Times this cue has been written onto / reused on a pose — powers "most used". */
  useCount: number;
  /** Last time the cue was applied to a pose — powers "most recent". */
  lastUsedAt: string;
  /** Tombstone: kept (hidden) so device sync propagates the deletion. */
  deletedAt?: string;
};

const KEY = "yoga-cues";

/** Trim + collapse whitespace + lowercase, for matching "same cue" regardless of casing/spacing. */
function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Every stored cue, tombstones included — for sync and backup. */
export function loadCuesRaw(): CueEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? withoutExpiredTombstones(JSON.parse(raw) as CueEntry[]) : [];
  } catch {
    return [];
  }
}

export function loadCues(): CueEntry[] {
  return loadCuesRaw().filter((c) => !c.deletedAt);
}

/** Sync apply: swap in the merged collection wholesale. Doesn't emit — the sync engine pushes explicitly. */
export function replaceAllCues(entries: CueEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(entries));
}

function persist(all: CueEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(all));
  emitDataChanged();
}

/**
 * Quietly keep a cue written onto a pose. Re-writing the same words for the same
 * pose bumps its recency/frequency instead of duplicating; a different wording
 * (or the same words on a different pose) becomes its own entry. Empty text is
 * ignored. Call this whenever a cue is genuinely written or reused on a pose.
 */
export function rememberCue(pose: string, rawText: string): void {
  const text = rawText.trim();
  if (!text) return;
  const all = loadCuesRaw();
  const key = normalize(text);
  const now = new Date().toISOString();
  const existing = all.find((c) => !c.deletedAt && c.pose === pose && normalize(c.text) === key);
  if (existing) {
    existing.useCount += 1;
    existing.lastUsedAt = now;
    // A use is an edit for sync purposes — without this, last-write-wins
    // merging would discard the bumped counters.
    existing.updatedAt = now;
  } else {
    all.push({
      id: generateId(),
      pose,
      text,
      createdAt: now,
      updatedAt: now,
      useCount: 1,
      lastUsedAt: now,
    });
  }
  persist(all);
}

/** Most-recently-used first. */
function byRecency(a: CueEntry, b: CueEntry): number {
  return b.lastUsedAt.localeCompare(a.lastUsedAt);
}

/** Past cues written for a given pose, most recent first — for varying a repeat. */
export function cuesForPose(pose: string): CueEntry[] {
  return loadCues()
    .filter((c) => c.pose === pose)
    .sort(byRecency);
}

/** The whole collection, most recent first. */
export function allCues(): CueEntry[] {
  return loadCues().sort(byRecency);
}

/** Add or replace a cue by id, preserving its fields — used by backup restore. */
export function saveCue(entry: CueEntry): void {
  const all = loadCuesRaw();
  const idx = all.findIndex((c) => c.id === entry.id);
  if (idx >= 0) all[idx] = entry;
  else all.push(entry);
  persist(all);
}

/** Reword a cue or fix a typo — never touches the cues in saved classes. */
export function updateCue(id: string, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  const all = loadCuesRaw();
  const entry = all.find((c) => c.id === id);
  if (!entry) return;
  entry.text = trimmed;
  entry.updatedAt = new Date().toISOString();
  persist(all);
}

/** Remove a cue from the library — saved classes keep theirs untouched. */
export function deleteCue(id: string): void {
  const now = new Date().toISOString();
  persist(
    loadCuesRaw().map((c) => (c.id === id ? { ...c, deletedAt: now, updatedAt: now } : c))
  );
}
