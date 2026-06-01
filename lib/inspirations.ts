export type InspirationEntry = {
  id: string;
  note: string;
  source?: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
};

const KEY = "yoga-inspirations";

export function loadInspirations(): InspirationEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
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
