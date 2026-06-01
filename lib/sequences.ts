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
  rounds?: number;
};

/** Combined multiplier for rounds and both-sides. Replaces ad-hoc secondSide*2 patterns. */
export function roundsMultiplier(section: Section): number {
  return (section.rounds ?? 1) * (section.secondSide ? 2 : 1);
}

export type TeachEntry = {
  date: string;   // ISO date YYYY-MM-DD
  notes?: string;
};

export type ThemeType = 'season' | 'peak-pose' | 'chakra' | 'meridian' | 'custom';

export type SequenceRecord = {
  id: string;
  name: string;
  theme?: string;
  themeType?: ThemeType;
  themeSub?: string;
  peakPose?: string;
  notes?: string;
  /**
   * Teaching log: each entry is a date (past or future) with optional notes.
   * Dates in the past = taught; dates in the future = planned.
   */
  dates: TeachEntry[];
  createdAt: string;
  updatedAt: string;
  sections: Section[];
  showAnalysis?: boolean;
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
const SEEDS_VERSION = 2;
const SEEDS_VERSION_KEY = "yoga-seeds-version";
const OLD_SEED_IDS = new Set(["seed-shoulder-opening", "seed-grounding-flow", "seed-hip-opening-45"]);

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Migrate a record: handle old schemas and normalize all pose items. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateRecord(raw: any): SequenceRecord {
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
  // 1 ── Hip freedom: well-worn class taught three times, notes showing evolution
  {
    id: "seed-hip-freedom",
    name: "Hip freedom",
    theme: "Creating space where we hold tension",
    peakPose: "Pigeon",
    showAnalysis: false,
    dates: [
      { date: "2026-04-14", notes: "First time with this structure. Went long on floor — had to cut wind-down short. Pigeon felt rushed. Need to trim the standing series or drop one neutral hip pose." },
      { date: "2026-05-05", notes: "Added Skandasana to the neutral hips round — beautiful transition from Crescent. Students loved it. Floor felt right this time. Wind-down was complete for the first time." },
      { date: "2026-05-20", notes: "This is the version I'll keep. Skandasana into Figure 4 Balance is the signature moment. Wheel landed for three people who'd never gotten it. Save this." },
    ],
    createdAt: "2026-04-12T09:00:00.000Z",
    updatedAt: "2026-05-20T09:00:00.000Z",
    sections: [
      {
        id: "hf-opening", title: "Opening", secondSide: false,
        poses: [
          p("hf-op-1", "Centering Breath"),
          p("hf-op-2", "Cat/Cow"),
          p("hf-op-3", "Child's Pose"),
          p("hf-op-4", "Downward Dog", "Bend the knees generously — we're just waking up"),
        ],
      },
      {
        id: "hf-surya-a", title: "Surya A", secondSide: false, rounds: 3,
        poses: [
          p("hf-sa-1",  "Mountain Pose"),
          p("hf-sa-2",  "Extended Mountain"),
          p("hf-sa-3",  "Standing Forward Fold"),
          p("hf-sa-4",  "Half Lift"),
          p("hf-sa-5",  "Plank"),
          p("hf-sa-6",  "Chaturanga"),
          p("hf-sa-7",  "Upward Dog"),
          p("hf-sa-8",  "Downward Dog"),
          p("hf-sa-9",  "Half Lift"),
          p("hf-sa-10", "Standing Forward Fold"),
          p("hf-sa-11", "Extended Mountain"),
          p("hf-sa-12", "Mountain Pose"),
        ],
      },
      {
        id: "hf-surya-b", title: "Surya B", secondSide: false, rounds: 2,
        poses: [
          p("hf-sb-1",  "Chair"),
          p("hf-sb-2",  "Standing Forward Fold"),
          p("hf-sb-3",  "Half Lift"),
          p("hf-sb-4",  "Vinyasa"),
          p("hf-sb-5",  "Warrior I"),
          p("hf-sb-6",  "Vinyasa"),
          p("hf-sb-7",  "Warrior I"),
          p("hf-sb-8",  "Vinyasa"),
          p("hf-sb-9",  "Standing Forward Fold"),
          p("hf-sb-10", "Half Lift"),
          p("hf-sb-11", "Chair"),
          p("hf-sb-12", "Mountain Pose"),
        ],
      },
      {
        id: "hf-neutral", title: "Neutral hips", secondSide: true,
        poses: [
          p("hf-nh-1", "Low Lunge"),
          p("hf-nh-2", "Crescent"),
          p("hf-nh-3", "Skandasana", "Fly your warrior sideways, bend one knee as you come back down"),
          p("hf-nh-4", "Figure 4 Balance"),
          p("hf-nh-5", "Vinyasa"),
        ],
      },
      {
        id: "hf-open", title: "Open hips", secondSide: true,
        poses: [
          p("hf-oh-1", "Warrior II"),
          p("hf-oh-2", "Triangle"),
          p("hf-oh-3", "Lizard", "Stay high if the hips are still warming up"),
          p("hf-oh-4", "Pyramid"),
        ],
      },
      {
        id: "hf-floor", title: "Floor", secondSide: false,
        poses: [
          p("hf-fl-1", "Sphinx"),
          p("hf-fl-2", "Locust"),
          p("hf-fl-3", "Locust"),
          p("hf-fl-4", "Bridge", "Interlace the hands, walk the shoulders under"),
          p("hf-fl-5", "Wheel"),
          p("hf-fl-6", "Constructive Rest"),
        ],
      },
      {
        id: "hf-winddown", title: "Wind-down", secondSide: true,
        poses: [
          p("hf-wd-1", "Pigeon", "This is what the whole class was building toward"),
          p("hf-wd-2", "Gomukhasana"),
          p("hf-wd-3", "Janu Sirsasana"),
        ],
      },
      {
        id: "hf-close", title: "Closing", secondSide: false,
        poses: [
          p("hf-cl-1", "Supine Twist"),
          p("hf-cl-2", "Savasana"),
        ],
      },
    ],
  },

  // 2 ── Heart opener: structural sketch, planned for next week
  {
    id: "seed-heart-opener",
    name: "Expanding what we can receive",
    theme: "Expanding what we can receive",
    peakPose: "Wheel",
    showAnalysis: false,
    dates: [{ date: "2026-06-02" }],
    createdAt: "2026-05-29T10:00:00.000Z",
    updatedAt: "2026-05-29T10:00:00.000Z",
    sections: [
      { id: "ho-opening",   title: "Opening",        secondSide: false, poses: [] },
      {
        id: "ho-surya-a", title: "Surya A", secondSide: false, rounds: 4,
        poses: [
          p("ho-sa-1",  "Mountain Pose"),
          p("ho-sa-2",  "Extended Mountain"),
          p("ho-sa-3",  "Standing Forward Fold"),
          p("ho-sa-4",  "Half Lift"),
          p("ho-sa-5",  "Plank"),
          p("ho-sa-6",  "Chaturanga"),
          p("ho-sa-7",  "Upward Dog"),
          p("ho-sa-8",  "Downward Dog"),
          p("ho-sa-9",  "Half Lift"),
          p("ho-sa-10", "Standing Forward Fold"),
          p("ho-sa-11", "Extended Mountain"),
          p("ho-sa-12", "Mountain Pose"),
        ],
      },
      { id: "ho-shoulders", title: "Shoulder series", secondSide: true,  poses: [] },
      {
        id: "ho-floor", title: "Floor", secondSide: false,
        poses: [
          p("ho-fl-1",  "Plank"),
          p("ho-fl-2",  "Forearm Plank"),
          p("ho-fl-3",  "Sphinx"),
          p("ho-fl-4",  "Locust"),
          p("ho-fl-5",  "Locust"),
          p("ho-fl-6",  "Bow"),
          p("ho-fl-7",  "Bridge"),
          p("ho-fl-8",  "Wheel"),
          p("ho-fl-9",  "Supta Baddhakonasana"),
          p("ho-fl-10", "Downward Dog"),
        ],
      },
      { id: "ho-winddown",  title: "Wind-down",       secondSide: false, poses: [] },
    ],
  },

  // 3 ── Finding steadiness: quick teaching log, no sections
  {
    id: "seed-finding-steadiness",
    name: "Finding steadiness",
    theme: "Finding steadiness",
    peakPose: "Eagle",
    showAnalysis: false,
    dates: [
      { date: "2026-05-27", notes: "Students were scattered today — this grounding theme landed. Held Eagle longer than planned, about 8 breaths each side. New cue: 'let your gaze soften as the body settles.' Keeping this." },
    ],
    createdAt: "2026-05-27T09:00:00.000Z",
    updatedAt: "2026-05-27T09:00:00.000Z",
    sections: [],
  },
];

export function loadSequences(): SequenceRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = SEED_SEQUENCES.map(migrateRecord);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      localStorage.setItem(SEEDS_VERSION_KEY, String(SEEDS_VERSION));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    const storedVersion = Number(localStorage.getItem(SEEDS_VERSION_KEY) ?? 0);
    let records: SequenceRecord[] = parsed;
    if (storedVersion < SEEDS_VERSION) {
      // Remove old seeds, inject new ones at the front
      records = (parsed as SequenceRecord[]).filter((r) => !OLD_SEED_IDS.has(r.id));
      records = [...SEED_SEQUENCES, ...records];
      localStorage.setItem(SEEDS_VERSION_KEY, String(SEEDS_VERSION));
    }
    const migrated = records.map(migrateRecord);
    // Write back if migration changed anything
    if (JSON.stringify(records) !== JSON.stringify(migrated) || storedVersion < SEEDS_VERSION) {
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
