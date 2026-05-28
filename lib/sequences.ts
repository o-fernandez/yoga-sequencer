export type PoseItem = {
  id: string;
  pose: string;
  duration: string;
  minutes: number;
  cue?: string;
};

export type Section = {
  id: string;
  title: string;
  secondSide: boolean;
  poses: PoseItem[];
};

export type SequenceRecord = {
  id: string;
  name: string;
  theme?: string;
  peakPose?: string;
  /**
   * Unified list of ISO date strings (YYYY-MM-DD).
   * Dates in the past = taught; dates in the future = planned.
   * Replaces the old separate taughtDates + intendedDate fields.
   */
  dates: string[];
  createdAt: string;
  updatedAt: string;
  sections: Section[];
};

const STORAGE_KEY = "yoga-sequences";

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Migrate a record from the old schema (taughtDates + intendedDate) to new (dates). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrate(raw: any): SequenceRecord {
  if (Array.isArray(raw.dates)) return raw as SequenceRecord;
  const merged = new Set<string>();
  if (Array.isArray(raw.taughtDates)) raw.taughtDates.forEach((d: string) => merged.add(d));
  if (typeof raw.intendedDate === "string" && raw.intendedDate) merged.add(raw.intendedDate);
  const { taughtDates: _t, intendedDate: _i, ...rest } = raw;
  return { ...rest, dates: [...merged].sort() } as SequenceRecord;
}

const SEED: SequenceRecord = {
  id: "seed-1",
  name: "Root chakra flow",
  theme: "Grounding and stability",
  peakPose: "Wheel",
  dates: [],
  createdAt: "2026-05-28T10:00:00.000Z",
  updatedAt: "2026-05-28T10:00:00.000Z",
  sections: [
    {
      id: "s1",
      title: "Opening",
      secondSide: false,
      poses: [
        { id: "p1", pose: "Centering Breath", duration: "3 min", minutes: 3 },
        { id: "p2", pose: "Cat/Cow", duration: "2 min", minutes: 2 },
        { id: "p3", pose: "Downward Dog", duration: "1 min", minutes: 1, cue: "Pedal legs if needed" },
      ],
    },
    {
      id: "s2",
      title: "Standing flow",
      secondSide: true,
      poses: [
        { id: "p4", pose: "Low Lunge", duration: "1 min", minutes: 1 },
        { id: "p5", pose: "Warrior II", duration: "1 min", minutes: 1, cue: "Reach through fingertips" },
        { id: "p6", pose: "Peaceful Warrior", duration: "45 sec", minutes: 0.75 },
        { id: "p7", pose: "Triangle", duration: "1 min", minutes: 1 },
      ],
    },
    {
      id: "s3",
      title: "Floor",
      secondSide: false,
      poses: [
        { id: "p8", pose: "Bridge", duration: "1 min", minutes: 1 },
        { id: "p9", pose: "Wheel", duration: "1 min", minutes: 1 },
        { id: "p10", pose: "Constructive Rest", duration: "1 min", minutes: 1 },
      ],
    },
    {
      id: "s4",
      title: "Closing",
      secondSide: false,
      poses: [
        { id: "p11", pose: "Seated Forward Fold", duration: "2 min", minutes: 2 },
        { id: "p12", pose: "Supine Twist", duration: "2 min", minutes: 2 },
        { id: "p13", pose: "Savasana", duration: "8 min", minutes: 8 },
      ],
    },
  ],
};

export function loadSequences(): SequenceRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([SEED]));
      return [SEED];
    }
    const parsed = JSON.parse(raw);
    const migrated = parsed.map(migrate);
    // Write back if migration changed anything
    if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return [];
  }
}

export function loadSequence(id: string): SequenceRecord | null {
  return loadSequences().find((s) => s.id === id) ?? null;
}

export function saveSequence(record: SequenceRecord): void {
  if (typeof window === "undefined") return;
  const all = loadSequences();
  const idx = all.findIndex((s) => s.id === record.id);
  if (idx === -1) {
    all.push(record);
  } else {
    all[idx] = record;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteSequence(id: string): void {
  if (typeof window === "undefined") return;
  const all = loadSequences().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function duplicateSequence(id: string): SequenceRecord | null {
  const original = loadSequence(id);
  if (!original) return null;
  const now = new Date().toISOString();
  const copy: SequenceRecord = {
    ...original,
    id: generateId(),
    name: `${original.name} (copy)`,
    dates: [],
    createdAt: now,
    updatedAt: now,
  };
  saveSequence(copy);
  return copy;
}
