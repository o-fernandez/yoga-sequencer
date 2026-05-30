import { getPoseMeta } from "./poses";

export type PoseItem = {
  id: string;
  pose: string;
  duration: string;
  minutes: number;
  cue?: string;
  breaths?: number;
  holdMode?: boolean;
};

// Breath pace zones from vinyasa research — rate is pose-type-aware:
//   1–2 breaths, any        →  5s  (~12 bpm: sun sal, one movement per breath)
//   3+ breaths, active      →  8s  (~8 bpm:  vigorous holds — Warrior, Plank…)
//   3+ breaths, restorative → 12s  (~5 bpm:  deep holds, floor, closing)
function secondsPerBreath(breaths: number, holdMode: boolean): number {
  if (breaths <= 2) return 5;
  return holdMode ? 12 : 8;
}

export function breathsToMinutes(breaths: number, holdMode: boolean): number {
  return (breaths * secondsPerBreath(breaths, holdMode)) / 60;
}

export function formatBreathEstimate(breaths: number, holdMode: boolean): string {
  const totalSecs = Math.round(breathsToMinutes(breaths, holdMode) * 60);
  if (totalSecs < 60) return `~${totalSecs}s`;
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return s === 0 ? `~${m}m` : `~${m}m ${s}s`;
}

export function normalizePoseItem(item: PoseItem): PoseItem {
  const meta = getPoseMeta(item.pose);
  const breaths = item.breaths ?? meta?.defaultBreaths ?? 5;
  // holdMode is always re-derived from the pose library on normalize — never trust
  // a stored value since it's computed, not user-set. Restorative poses (~5 bpm)
  // breathe slower than active holds (~8 bpm).
  const holdMode = meta?.defaultHoldMode ?? false;
  const minutes = breathsToMinutes(breaths, holdMode);
  return {
    ...item,
    breaths,
    holdMode,
    minutes,
    duration: `${breaths} breath${breaths === 1 ? "" : "s"}`,
  };
}

export type Section = {
  id: string;
  title: string;
  secondSide: boolean;
  poses: PoseItem[];
};

export type TeachEntry = {
  date: string;   // ISO date YYYY-MM-DD
  notes?: string;
};

export type SequenceRecord = {
  id: string;
  name: string;
  theme?: string;
  peakPose?: string;
  /**
   * Teaching log: each entry is a date (past or future) with optional notes.
   * Dates in the past = taught; dates in the future = planned.
   */
  dates: TeachEntry[];
  createdAt: string;
  updatedAt: string;
  sections: Section[];
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export function isTaught(entry: TeachEntry): boolean {
  return entry.date <= todayISO();
}

export function sortedTaughtEntries(dates: TeachEntry[]): TeachEntry[] {
  return dates.filter(isTaught).sort((a, b) => b.date.localeCompare(a.date));
}

export function sortedUpcomingEntries(dates: TeachEntry[]): TeachEntry[] {
  return dates.filter((e) => !isTaught(e)).sort((a, b) => a.date.localeCompare(b.date));
}

const STORAGE_KEY = "yoga-sequences";

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Migrate a record: handle old schemas and normalize all pose items. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrate(raw: any): SequenceRecord {
  let record: SequenceRecord;
  if (Array.isArray(raw.dates) && raw.dates.length > 0 && typeof raw.dates[0] === "object") {
    // Already TeachEntry[]
    record = raw as SequenceRecord;
  } else if (Array.isArray(raw.dates)) {
    // string[] → TeachEntry[]
    const merged = new Set<string>(raw.dates as string[]);
    record = { ...raw, dates: [...merged].sort().map((d) => ({ date: d })) } as SequenceRecord;
  } else {
    // Oldest schema: taughtDates + intendedDate
    const merged = new Set<string>();
    if (Array.isArray(raw.taughtDates)) raw.taughtDates.forEach((d: string) => merged.add(d));
    if (typeof raw.intendedDate === "string" && raw.intendedDate) merged.add(raw.intendedDate);
    const rest = { ...raw };
    delete rest.taughtDates;
    delete rest.intendedDate;
    record = { ...rest, dates: [...merged].sort().map((d) => ({ date: d })) } as SequenceRecord;
  }
  return {
    ...record,
    sections: record.sections.map((section) => ({
      ...section,
      poses: section.poses.map(normalizePoseItem),
    })),
  };
}

/** Build a PoseItem for seed sequences with breaths defaults applied. */
function p(id: string, pose: string, cue?: string): PoseItem {
  return normalizePoseItem({
    id,
    pose,
    duration: "",
    minutes: 0,
    ...(cue ? { cue } : {}),
  });
}

const SEED_SEQUENCES: SequenceRecord[] = [
  // 1 ── Building-rounds shoulder opener (his confirmed March 2026 structure)
  {
    id: "seed-shoulder-opening",
    name: "Shoulder Opening — Building Rounds",
    theme: "Heart and shoulder opening",
    peakPose: "Crow",
    dates: [{ date: "2026-03-15" }, { date: "2026-04-12" }, { date: "2026-05-31" }],
    createdAt: "2026-03-12T09:00:00.000Z",
    updatedAt: "2026-05-20T09:00:00.000Z",
    sections: [
      {
        id: "sh-warmup", title: "Warm-up", secondSide: false,
        poses: [
          p("sh-1", "Centering Breath"),
          p("sh-2", "Cat/Cow"),
          p("sh-3", "Child's Pose"),
          p("sh-4", "Downward Dog", "Bend the knees generously, pedal the heels to wake up the calves"),
        ],
      },
      {
        id: "sh-suryaA", title: "Surya A ×4", secondSide: false,
        poses: [
          p("sh-5", "Mountain Pose"),
          p("sh-6", "Standing Forward Fold"),
          p("sh-7", "Half Lift"),
          p("sh-8", "Plank"),
          p("sh-9", "Chaturanga"),
          p("sh-10", "Upward Dog"),
          p("sh-11", "Downward Dog"),
        ],
      },
      {
        id: "sh-round1", title: "Round 1 · Neutral Hips", secondSide: true,
        poses: [
          p("sh-12", "Chair", "Eagle arms — take both sides within the hold"),
          p("sh-13", "Warrior I"),
          p("sh-14", "Low Lunge"),
          p("sh-15", "Eagle", "Lift the elbows to shoulder height — feel the space open between the shoulder blades"),
          p("sh-16", "Vinyasa"),
        ],
      },
      {
        id: "sh-round2", title: "Round 2 · Open Hips", secondSide: true,
        poses: [
          p("sh-17", "Warrior I"),
          p("sh-18", "Devotional Warrior", "Interlace the hands behind the back, fold the forehead toward the inside of the front foot"),
          p("sh-19", "Warrior II"),
          p("sh-20", "Peaceful Warrior"),
          p("sh-21", "Triangle"),
          p("sh-22", "Extended Side Angle"),
          p("sh-23", "Vinyasa"),
        ],
      },
      {
        id: "sh-round3", title: "Round 3 · Peak", secondSide: true,
        poses: [
          p("sh-24", "Devotional Warrior"),
          p("sh-25", "Pyramid"),
          p("sh-26", "Warrior II"),
          p("sh-27", "Triangle"),
          p("sh-28", "Half Moon"),
          p("sh-29", "Chair"),
          p("sh-30", "Crow", "Tip the weight forward into the hands until the feet float"),
          p("sh-31", "Vinyasa"),
        ],
      },
      {
        id: "sh-floor", title: "Floor", secondSide: false,
        poses: [
          p("sh-32", "Forearm Plank"),
          p("sh-33", "Sphinx"),
          p("sh-34", "Locust"),
          p("sh-35", "Bow"),
          p("sh-36", "Bridge", "Interlace the hands beneath you, walk the shoulders under"),
          p("sh-37", "Wheel", "This is what we came here for"),
          p("sh-38", "Constructive Rest"),
        ],
      },
      {
        id: "sh-winddown", title: "Wind-down (one side, then the other)", secondSide: true,
        poses: [
          p("sh-39", "Pigeon"),
          p("sh-40", "Gomukhasana"),
          p("sh-41", "Janu Sirsasana"),
          p("sh-42", "Stargazer"),
          p("sh-43", "Downward Dog"),
        ],
      },
      {
        id: "sh-close", title: "Savasana", secondSide: false,
        poses: [p("sh-44", "Savasana")],
      },
    ],
  },

  // 2 ── Flat-architecture grounding flow (his YO BK comfort zone)
  {
    id: "seed-grounding-flow",
    name: "Grounding Power Flow",
    theme: "Steadiness and grounding",
    peakPose: "Half Moon",
    dates: [{ date: "2026-02-08" }, { date: "2026-04-26" }, { date: "2026-05-17" }],
    createdAt: "2026-02-05T09:00:00.000Z",
    updatedAt: "2026-05-17T09:00:00.000Z",
    sections: [
      {
        id: "gr-warmup", title: "Warm-up", secondSide: false,
        poses: [
          p("gr-1", "Centering Breath"),
          p("gr-2", "Cat/Cow"),
          p("gr-3", "Downward Dog"),
          p("gr-4", "Beast", "Knees hovering an inch off the floor — quiet and strong"),
        ],
      },
      {
        id: "gr-suryaA", title: "Surya A ×4", secondSide: false,
        poses: [
          p("gr-5", "Mountain Pose"),
          p("gr-6", "Standing Forward Fold"),
          p("gr-7", "Half Lift"),
          p("gr-8", "Plank"),
          p("gr-9", "Chaturanga"),
          p("gr-10", "Upward Dog"),
          p("gr-11", "Downward Dog"),
        ],
      },
      {
        id: "gr-suryaB", title: "Surya B ×2", secondSide: false,
        poses: [
          p("gr-12", "Chair"),
          p("gr-13", "Warrior I"),
          p("gr-14", "Vinyasa"),
        ],
      },
      {
        id: "gr-neutral", title: "Neutral Hips", secondSide: true,
        poses: [
          p("gr-15", "Low Lunge"),
          p("gr-16", "Crescent"),
          p("gr-17", "Warrior III"),
          p("gr-18", "Eagle"),
          p("gr-19", "Vinyasa"),
        ],
      },
      {
        id: "gr-open", title: "Open Hips", secondSide: true,
        poses: [
          p("gr-20", "Warrior II"),
          p("gr-21", "Peaceful Warrior"),
          p("gr-22", "Triangle"),
          p("gr-23", "Half Moon", "Stack the top hip, reach the top fingertips to the ceiling"),
          p("gr-24", "Prasarita"),
        ],
      },
      {
        id: "gr-midline", title: "Midline Close", secondSide: false,
        poses: [
          p("gr-25", "Chair"),
          p("gr-26", "Malasana"),
          p("gr-27", "Crow"),
        ],
      },
      {
        id: "gr-floor", title: "Floor", secondSide: false,
        poses: [
          p("gr-28", "Forearm Plank"),
          p("gr-29", "Sphinx"),
          p("gr-30", "Locust"),
          p("gr-31", "Bridge"),
          p("gr-32", "Constructive Rest"),
        ],
      },
      {
        id: "gr-winddown", title: "Wind-down (one side, then the other)", secondSide: true,
        poses: [
          p("gr-33", "Pigeon"),
          p("gr-34", "Janu Sirsasana"),
        ],
      },
      {
        id: "gr-close", title: "Close", secondSide: false,
        poses: [
          p("gr-35", "Seated Forward Fold"),
          p("gr-36", "Supine Twist"),
          p("gr-37", "Savasana"),
        ],
      },
    ],
  },

  // 3 ── Tight 45-min hip opener (hip emphasis shifted into the wind-down)
  {
    id: "seed-hip-opening-45",
    name: "Hip Opening — 45 min",
    theme: "Releasing the hips",
    peakPose: "Lizard",
    dates: [{ date: "2026-05-10" }, { date: "2026-06-07" }],
    createdAt: "2026-05-06T09:00:00.000Z",
    updatedAt: "2026-05-10T09:00:00.000Z",
    sections: [
      {
        id: "hi-warmup", title: "Warm-up", secondSide: false,
        poses: [
          p("hi-1", "Centering Breath"),
          p("hi-2", "Cat/Cow"),
          p("hi-3", "Downward Dog"),
        ],
      },
      {
        id: "hi-suryaA", title: "Surya A ×3", secondSide: false,
        poses: [
          p("hi-4", "Mountain Pose"),
          p("hi-5", "Standing Forward Fold"),
          p("hi-6", "Half Lift"),
          p("hi-7", "Plank"),
          p("hi-8", "Chaturanga"),
          p("hi-9", "Upward Dog"),
        ],
      },
      {
        id: "hi-neutral", title: "Neutral Hips", secondSide: true,
        poses: [
          p("hi-10", "Low Lunge"),
          p("hi-11", "Skandasana", "Fly your warrior to face the side of the room, bend one knee as you come back and down"),
          p("hi-12", "Figure 4 Balance"),
          p("hi-13", "Vinyasa"),
        ],
      },
      {
        id: "hi-open", title: "Open Hips", secondSide: true,
        poses: [
          p("hi-14", "Warrior II"),
          p("hi-15", "Triangle"),
          p("hi-16", "Lizard"),
        ],
      },
      {
        id: "hi-floor", title: "Floor", secondSide: false,
        poses: [
          p("hi-17", "Sphinx"),
          p("hi-18", "Bridge"),
          p("hi-19", "Supta Baddhakonasana"),
        ],
      },
      {
        id: "hi-winddown", title: "Wind-down (one side, then the other)", secondSide: true,
        poses: [
          p("hi-20", "Pigeon"),
          p("hi-21", "Gomukhasana"),
        ],
      },
      {
        id: "hi-close", title: "Close", secondSide: false,
        poses: [
          p("hi-22", "Happy Baby"),
          p("hi-23", "Savasana"),
        ],
      },
    ],
  },
];

export function loadSequences(): SequenceRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = SEED_SEQUENCES.map(migrate);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    const migrated = parsed.map(migrate);
    // Write back if migration changed anything (e.g. breaths normalization on first deploy)
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
