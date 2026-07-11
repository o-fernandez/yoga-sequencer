import { daysFromToday, examplesCleared, timestampDaysAgo } from "./sequences";
import { emitDataChanged } from "./data-changed";
import { withoutExpiredTombstones } from "./sync-merge";

export type InspirationEntry = {
  id: string;
  note: string;
  source?: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  /** Tombstone: kept (hidden) so device sync propagates the deletion. */
  deletedAt?: string;
};

const KEY = "yoga-inspirations";
const SEEDS_KEY = "yoga-inspirations-seeded";

/** Seed dates are relative to first load so the examples stay evergreen. */
function buildSeedInspirations(): InspirationEntry[] {
  return [
    {
      id: "insp-seed-1",
      note: "The pose is not the point. The pose is a context in which to practice being human.",
      source: "Donna Farhi, Bringing Yoga to Life",
      date: daysFromToday(-82),
      createdAt: timestampDaysAgo(82),
      updatedAt: timestampDaysAgo(82),
    },
    {
      id: "insp-seed-2",
      note: "Noticed that the students who struggled most in balance poses were also the most visibly 'trying.' The trying is the obstacle. What would it look like to cue less effort and more listening?",
      source: "",
      date: daysFromToday(-31),
      createdAt: timestampDaysAgo(31),
      updatedAt: timestampDaysAgo(31),
    },
    {
      id: "insp-seed-3",
      note: "The way she cued 'let your breath be the architect of the movement' — the whole room softened at once. I want to build a whole class around that one idea.",
      source: "Sunday workshop",
      date: daysFromToday(-67),
      createdAt: timestampDaysAgo(67),
      updatedAt: timestampDaysAgo(67),
    },
  ];
}

export function isExampleInspiration(id: string): boolean {
  return id.startsWith("insp-seed-");
}

/** Every stored entry, tombstones included — for sync and backup. */
export function loadInspirationsRaw(): InspirationEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      if (examplesCleared()) return [];
      const seeded = buildSeedInspirations();
      localStorage.setItem(KEY, JSON.stringify(seeded));
      localStorage.setItem(SEEDS_KEY, "1");
      return seeded;
    }
    return withoutExpiredTombstones(JSON.parse(raw) as InspirationEntry[]);
  } catch {
    return [];
  }
}

export function loadInspirations(): InspirationEntry[] {
  return loadInspirationsRaw().filter((e) => !e.deletedAt);
}

/** Sync apply: swap in the merged collection wholesale. Doesn't emit — the sync engine pushes explicitly. */
export function replaceAllInspirations(entries: InspirationEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(entries));
  localStorage.setItem(SEEDS_KEY, "1");
}

export function saveInspiration(entry: InspirationEntry): void {
  const all = loadInspirationsRaw();
  const idx = all.findIndex((e) => e.id === entry.id);
  if (idx >= 0) all[idx] = entry;
  else all.unshift(entry);
  localStorage.setItem(KEY, JSON.stringify(all));
  emitDataChanged();
}

export function deleteInspiration(id: string): void {
  const now = new Date().toISOString();
  const all = loadInspirationsRaw().map((e) =>
    e.id === id ? { ...e, deletedAt: now, updatedAt: now } : e
  );
  localStorage.setItem(KEY, JSON.stringify(all));
  emitDataChanged();
}

/** Remove all example inspirations, keeping the user's own. */
export function removeExampleInspirations(): void {
  if (typeof window === "undefined") return;
  const now = new Date().toISOString();
  // Tombstone rather than drop, so sync propagates the removal to other devices.
  const all = loadInspirationsRaw().map((e) =>
    isExampleInspiration(e.id) && !e.deletedAt ? { ...e, deletedAt: now, updatedAt: now } : e
  );
  localStorage.setItem(KEY, JSON.stringify(all));
  emitDataChanged();
}

/** Start over: drop everything and reseed the example inspirations fresh. */
export function resetInspirationsToSeeds(): void {
  if (typeof window === "undefined") return;
  const now = new Date().toISOString();
  // The user's own entries become tombstones so the reset carries over sync;
  // examples are rebuilt fresh (same ids as the live seeds, so no tombstones).
  const tombstones = loadInspirationsRaw()
    .filter((e) => !isExampleInspiration(e.id))
    .map((e) => (e.deletedAt ? e : { ...e, deletedAt: now, updatedAt: now }));
  localStorage.setItem(KEY, JSON.stringify([...buildSeedInspirations(), ...tombstones]));
  localStorage.setItem(SEEDS_KEY, "1");
  emitDataChanged();
}
