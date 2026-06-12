import { daysFromToday, examplesCleared, timestampDaysAgo } from "./sequences";

export type InspirationEntry = {
  id: string;
  note: string;
  source?: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
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

export function loadInspirations(): InspirationEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      if (examplesCleared()) return [];
      const seeded = buildSeedInspirations();
      localStorage.setItem(KEY, JSON.stringify(seeded));
      localStorage.setItem(SEEDS_KEY, "1");
      return seeded;
    }
    return JSON.parse(raw) as InspirationEntry[];
  } catch {
    return [];
  }
}

export function saveInspiration(entry: InspirationEntry): void {
  const all = loadInspirations();
  const idx = all.findIndex((e) => e.id === entry.id);
  if (idx >= 0) all[idx] = entry;
  else all.unshift(entry);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteInspiration(id: string): void {
  const filtered = loadInspirations().filter((e) => e.id !== id);
  localStorage.setItem(KEY, JSON.stringify(filtered));
}

/** Remove all example inspirations, keeping the user's own. */
export function removeExampleInspirations(): void {
  if (typeof window === "undefined") return;
  const kept = loadInspirations().filter((e) => !isExampleInspiration(e.id));
  localStorage.setItem(KEY, JSON.stringify(kept));
}

/** Start over: drop everything and reseed the example inspirations fresh. */
export function resetInspirationsToSeeds(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(buildSeedInspirations()));
  localStorage.setItem(SEEDS_KEY, "1");
}
