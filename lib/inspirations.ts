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

const SEED_INSPIRATIONS: InspirationEntry[] = [
  {
    id: "insp-seed-1",
    note: "The pose is not the point. The pose is a context in which to practice being human.",
    source: "Donna Farhi, Bringing Yoga to Life",
    date: "2026-03-22",
    createdAt: "2026-03-22T10:00:00.000Z",
    updatedAt: "2026-03-22T10:00:00.000Z",
  },
  {
    id: "insp-seed-2",
    note: "Noticed that the students who struggled most in balance poses were also the most visibly 'trying.' The trying is the obstacle. What would it look like to cue less effort and more listening?",
    source: "",
    date: "2026-05-12",
    createdAt: "2026-05-12T18:30:00.000Z",
    updatedAt: "2026-05-12T18:30:00.000Z",
  },
  {
    id: "insp-seed-3",
    note: "The way she cued 'let your breath be the architect of the movement' — the whole room softened at once. I want to build a whole class around that one idea.",
    source: "Sunday workshop",
    date: "2026-04-06",
    createdAt: "2026-04-06T12:00:00.000Z",
    updatedAt: "2026-04-06T12:00:00.000Z",
  },
];

export function loadInspirations(): InspirationEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(SEED_INSPIRATIONS));
      localStorage.setItem(SEEDS_KEY, "1");
      return SEED_INSPIRATIONS;
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
