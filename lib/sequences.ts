import { getPoseMeta } from "./poses";

export type PoseItem = {
  id: string;
  pose: string;
  duration: string;
  minutes: number;
  cue?: string;
  breaths?: number;
  holdMode?: boolean;
  /**
   * Carries the class theme. A property of the pose, so it follows the pose
   * across both-sides passes and repeating rounds. The peak is tracked
   * separately as the sequence-level `peakPose` (one source of truth).
   */
  themePose?: boolean;
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

export type ThemeType = 'season' | 'chakra' | 'meridian' | 'custom';

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

function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today as YYYY-MM-DD in the device's timezone — an evening class is still "today". */
export function localTodayISO(): string {
  return toLocalISODate(new Date());
}

export function isTaught(entry: TeachEntry): boolean {
  return entry.date <= localTodayISO();
}

export function sortedTaughtEntries(dates: TeachEntry[]): TeachEntry[] {
  return dates.filter(isTaught).sort((a, b) => b.date.localeCompare(a.date));
}

export function sortedUpcomingEntries(dates: TeachEntry[]): TeachEntry[] {
  return dates.filter((e) => !isTaught(e)).sort((a, b) => a.date.localeCompare(b.date));
}

const STORAGE_KEY = "yoga-sequences";
const SEEDS_VERSION = 5;
const SEEDS_VERSION_KEY = "yoga-seeds-version";
const EXAMPLES_CLEARED_KEY = "yoga-examples-cleared";
const EXAMPLES_NOTICE_DISMISSED_KEY = "yoga-examples-notice-dismissed";
const OLD_SEED_IDS = new Set([
  "seed-shoulder-opening", "seed-grounding-flow", "seed-hip-opening-45",            // v1
  "seed-hip-freedom", "seed-heart-opener", "seed-finding-steadiness",               // v2
  "seed-hip-freedom-v3", "seed-heart-opener-v3", "seed-finding-steadiness-v3",      // v3
  "seed-kidney-meridian-v3",                                                        // v3
  "seed-hip-freedom-v4", "seed-heart-opener-v4", "seed-finding-steadiness-v4",      // v4
  "seed-kidney-meridian-v4",                                                        // v4
]);

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
function p(id: string, pose: string, cue?: string, themePose?: boolean): PoseItem {
  return normalizePoseItem({
    id,
    pose,
    duration: "",
    minutes: 0,
    ...(cue ? { cue } : {}),
    ...(themePose ? { themePose: true } : {}),
  });
}

/** YYYY-MM-DD `offset` days from today (negative = past), in local time. */
export function daysFromToday(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toLocalISODate(d);
}

/** Full ISO timestamp `days` days ago, at a quiet morning hour. */
export function timestampDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

// ─── Example (seed) management ───────────────────────────────────────────────

export function isExampleSequence(id: string): boolean {
  return id.startsWith("seed-");
}

/** True once the user has removed the examples — seeding stays off for good. */
export function examplesCleared(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(EXAMPLES_CLEARED_KEY) === "1";
}

/** True once the user has dismissed the examples notice but kept the examples. */
export function examplesNoticeDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(EXAMPLES_NOTICE_DISMISSED_KEY) === "1";
}

/** Hide the examples notice for good while leaving the example classes in place. */
export function dismissExamplesNotice(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(EXAMPLES_NOTICE_DISMISSED_KEY, "1");
}

/** Remove all example classes, keep the user's own, and suppress future seeding. */
export function removeExampleSequences(): void {
  if (typeof window === "undefined") return;
  const kept = loadSequences().filter((s) => !isExampleSequence(s.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
  localStorage.setItem(SEEDS_VERSION_KEY, String(SEEDS_VERSION));
  localStorage.setItem(EXAMPLES_CLEARED_KEY, "1");
}

/** Start over: drop everything and reseed the examples with fresh relative dates. */
export function resetSequencesToSeeds(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(EXAMPLES_CLEARED_KEY);
  localStorage.removeItem(EXAMPLES_NOTICE_DISMISSED_KEY);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSeedSequences().map(migrateRecord)));
  localStorage.setItem(SEEDS_VERSION_KEY, String(SEEDS_VERSION));
}

/**
 * Seed dates are computed relative to the day the seeds land on a device, so
 * the examples stay evergreen: a teaching history that reads as recent, and
 * one or two classes planned in the coming week so the library's time-aware
 * features (Teaching Ahead strip, taught dots) are alive on first open.
 */
function buildSeedSequences(): SequenceRecord[] {
  return [
  // 0 ── Lateral chain opening: Summer, building-rounds power class with full
  //      theme/peak markers — planned for tomorrow so it leads the library.
  {
    id: "seed-lateral-chain-v5",
    name: "Lateral chain opening",
    theme: "Opening the side body — creating space where we hold on",
    themeType: "season",
    themeSub: "Summer",
    peakPose: "Extended Side Angle",
    showAnalysis: false,
    notes:
      "60-min hot vinyasa · 95° room · Building-rounds (Round 1 introduce → 2 deepen → 3 peak). " +
      "45-min version: skip the ⬡ poses (Triangle in Round 2, Crow in Round 3, Wheel in the floor series).\n\n" +
      "Dharma talk (~90s, seated in Sukhasana): Es verano. El sol ya está arriba y el calor es real — no solo " +
      "aquí adentro. Todo se expande en verano. Hoy exploramos el movimiento lateral — abrir los lados del cuerpo, " +
      "crear espacio donde a veces cargamos tensión sin saber. Extended Side Angle es un arco: una línea desde el " +
      "pie hasta los dedos. Para hacer ese arco, tienes que ceder — soltar el costado que se resiste. ¿Dónde me " +
      "estoy apretando? ¿Qué pasa si simplemente… alargo?\n\n" +
      "Props: strap for the ESA bind — offer it as an equal option, not a regression.\n\n" +
      "Dwell poses: Pyramid (Round 3, 5 breaths) · ESA (Round 3, 5–8 breaths) · Pigeon (as long as time allows).\n\n" +
      "Physical checks: Gomukhasana arms in Triangle ONLY (blocked in ESA by the torso angle). " +
      "After Wheel, always Constructive Rest before seated — 95° room.",
    dates: [{ date: daysFromToday(1) }],
    createdAt: timestampDaysAgo(0),
    updatedAt: timestampDaysAgo(0),
    sections: [
      {
        id: "lc-warmup", title: "Warm-up", secondSide: false,
        poses: [
          p("lc-wu-1", "Sukhasana", "Seated. Settle. Today we open the lateral line."),
          p("lc-wu-2", "Seated Side Bend", "R then L. Hands overhead, lengthen the side body — feel the ribs stack and separate. This is the theme's first physical statement.", true),
          p("lc-wu-3", "Cat/Cow", "4 rounds"),
          p("lc-wu-4", "Thread the Needle", "R then L — thoracic rotation to complement the lateral opening"),
          p("lc-wu-5", "Gate Pose", "R then L. One knee down, the other leg long to the side. Reach the top arm — make a bow shape with your whole side body. A preview of the ESA line.", true),
          p("lc-wu-6", "Downward Dog", "5 breaths"),
          p("lc-wu-7", "Plank", "Hip dips — sway the hips side to side, both ways. Lateral core."),
          p("lc-wu-8", "Downward Dog", "Reset after the hip dips"),
          p("lc-wu-9", "Standing Forward Fold", "Walk or float to the top of the mat → half-lift → rise to Mountain"),
          p("lc-wu-10", "Mountain Pose"),
        ],
      },
      {
        id: "lc-surya-a", title: "Surya A", secondSide: false, rounds: 3,
        poses: [
          p("lc-sa-1",  "Mountain Pose", "Breath to movement. Standard — no lateral variation. Let the body warm evenly before the theme lands."),
          p("lc-sa-2",  "Extended Mountain"),
          p("lc-sa-3",  "Standing Forward Fold"),
          p("lc-sa-4",  "Half Lift"),
          p("lc-sa-5",  "Plank"),
          p("lc-sa-6",  "Chaturanga"),
          p("lc-sa-7",  "Upward Dog"),
          p("lc-sa-8",  "Downward Dog"),
          p("lc-sa-9",  "Half Lift"),
          p("lc-sa-10", "Standing Forward Fold"),
          p("lc-sa-11", "Extended Mountain"),
          p("lc-sa-12", "Mountain Pose"),
        ],
      },
      {
        id: "lc-round-1", title: "Round 1 · Introduce", secondSide: true,
        poses: [
          p("lc-r1-1", "Warrior I"),
          p("lc-r1-2", "Devotional Warrior", "First lateral opening — chest toward the inside of the front foot, hands interlaced behind the back.", true),
          p("lc-r1-3", "Warrior II", "Rise"),
          p("lc-r1-4", "Peaceful Warrior", "Back hand slides down the back leg, front arm reaches long overhead — the bow shape from this morning.", true),
          p("lc-r1-5", "Triangle", "Bottom hand to shin or block"),
          p("lc-r1-6", "Extended Side Angle", "Forearm to thigh. Top arm overhead alongside the ear — one long line from back foot to fingertips. Breathe into the side ribs.", true),
          p("lc-r1-7", "Half Moon", "→ Forward Fold → Vinyasa"),
          p("lc-r1-8", "Vinyasa"),
        ],
      },
      {
        id: "lc-round-2", title: "Round 2 · Deepen", secondSide: true,
        poses: [
          p("lc-r2-1", "Warrior I"),
          p("lc-r2-2", "Devotional Warrior", undefined, true),
          p("lc-r2-3", "Pyramid", "Straighten the front leg, both hips square. Let the side body breathe. Closed-hip prep — hamstrings + QL."),
          p("lc-r2-4", "Warrior II", "Bend the front knee, spin the back foot"),
          p("lc-r2-5", "Peaceful Warrior", undefined, true),
          p("lc-r2-6", "Triangle", "⬡ 45-min: skip straight to ESA"),
          p("lc-r2-7", "Extended Side Angle", "Full arm extension — fingertips toward the wall ahead. The whole side in one unbroken line. ⬡ Optional bind: bottom arm threads under the front thigh; clasp or strap.", true),
          p("lc-r2-8", "Half Moon", "→ Forward Fold → Vinyasa"),
          p("lc-r2-9", "Vinyasa"),
        ],
      },
      {
        id: "lc-round-3", title: "Round 3 · Peak", secondSide: true,
        poses: [
          p("lc-r3-1", "Warrior I"),
          p("lc-r3-2", "Devotional Warrior", "Deeper hold — 5 breaths", true),
          p("lc-r3-3", "Pyramid", "Longer hold — let the lateral chain fully release. 5 breaths. This is where we earn the next shape.", true),
          p("lc-r3-4", "Warrior II", "Bend the front knee, spin the back foot"),
          p("lc-r3-5", "Peaceful Warrior", undefined, true),
          p("lc-r3-6", "Triangle", "Gomukhasana arms — top arm bends behind the head, bottom reaches toward the shin, elbow to the ceiling. (Gomukhasana arms in Triangle ONLY — not in ESA.)"),
          p("lc-r3-7", "Extended Side Angle", "Full bind — the peak. Hold 5–8 breaths. Breathe into the top ribs, the most compressed. No bind? Top arm reaches long. Either way: make the bow.", true),
          p("lc-r3-8", "Half Moon", "From ESA, shift weight to the front foot, lift the back leg"),
          p("lc-r3-9", "Chair", "Forward Fold → Chair → Eagle"),
          p("lc-r3-10", "Eagle", "Signature transition — home base, grounds the peak. Right leg forward = right arm on top."),
          p("lc-r3-11", "Crow", "⬡ 45-min: skip. Diver's → Crow."),
          p("lc-r3-12", "Vinyasa"),
        ],
      },
      {
        id: "lc-floor", title: "Floor series", secondSide: false,
        poses: [
          p("lc-fl-1", "Plank", "→ Forearm Plank"),
          p("lc-fl-2", "Forearm Plank", "5 breaths"),
          p("lc-fl-3", "Side Plank", "Right side. Stack the hips. You've opened the side body all class — now you hold it.", true),
          p("lc-fl-4", "Twisted Crescent", "Twisted low lunge — signature transition, flows from Side Plank"),
          p("lc-fl-5", "Downward Dog"),
          p("lc-fl-6", "Side Plank", "Left side.", true),
          p("lc-fl-7", "Twisted Crescent", "Twisted low lunge"),
          p("lc-fl-8", "Downward Dog", "→ Sphinx → Locust"),
          p("lc-fl-9", "Sphinx"),
          p("lc-fl-10", "Locust"),
          p("lc-fl-11", "Locust", "2 rounds"),
          p("lc-fl-12", "Bow", "Floor Bow — opens the front body, counterbalances the lateral compression"),
          p("lc-fl-13", "Bridge", "Standard, or interlace the hands beneath"),
          p("lc-fl-14", "Wheel", "⬡ 45-min: skip"),
          p("lc-fl-15", "Constructive Rest", "Knees to chest, sway side to side. 95° room — always reset here before seated after Wheel."),
          p("lc-fl-16", "Supta Baddhakonasana", "2 min — nervous-system reset, hips open passively before wind-down"),
        ],
      },
      {
        id: "lc-winddown", title: "Wind-down", secondSide: false,
        poses: [
          p("lc-wd-1", "Downward Dog", "Bridge from the floor reset — decompress the spine, set up Pigeon"),
          p("lc-wd-2", "Pigeon", "Right side.", true),
          p("lc-wd-3", "Janu Sirsasana", "Right side. Reach the right side long over the shin — the same bow shape we've made all class. Cue laterally, not just forward.", true),
          p("lc-wd-4", "Downward Dog", "Bridge to the left side"),
          p("lc-wd-5", "Pigeon", "Left side.", true),
          p("lc-wd-6", "Janu Sirsasana", "Left side.", true),
          p("lc-wd-7", "Seated Forward Fold", "Paschimottanasana — 5–8 breaths. Symmetric close; all that lateral work lands here."),
          p("lc-wd-8", "Supine Twist", "R then L. One last lateral release. The floor holds you now."),
          p("lc-wd-9", "Savasana", "3+ min"),
        ],
      },
    ],
  },

  // 1 ── Hip freedom: Kapha season, well-worn class taught three times with
  //      notes showing evolution, planned again next week
  {
    id: "seed-hip-freedom-v5",
    name: "Hip freedom",
    theme: "Creating space where we hold tension",
    themeType: "season",
    themeSub: "Kapha",
    peakPose: "Pigeon",
    showAnalysis: false,
    dates: [
      { date: daysFromToday(-58), notes: "First time with this structure. Went long on floor — had to cut wind-down short. Pigeon felt rushed. Need to trim the standing series or drop one neutral hip pose." },
      { date: daysFromToday(-37), notes: "Added Skandasana to the neutral hips round — beautiful transition from Crescent. Students loved it. Floor felt right this time. Wind-down was complete for the first time." },
      { date: daysFromToday(-22), notes: "This is the version I'll keep. Skandasana into Figure 4 Balance is the signature moment. Wheel landed for three people who'd never gotten it. Save this." },
      { date: daysFromToday(5) },
    ],
    createdAt: timestampDaysAgo(60),
    updatedAt: timestampDaysAgo(22),
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

  // 2 ── Heart opener: Anahata chakra, structural sketch, planned in a few days
  {
    id: "seed-heart-opener-v5",
    name: "Expanding what we can receive",
    theme: "Expanding what we can receive",
    themeType: "chakra",
    themeSub: "4 · Anahata (heart)",
    peakPose: "Wheel",
    showAnalysis: false,
    dates: [{ date: daysFromToday(3) }],
    createdAt: timestampDaysAgo(13),
    updatedAt: timestampDaysAgo(13),
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

  // 3 ── Finding steadiness: Muladhara chakra, quick teaching log entry
  {
    id: "seed-finding-steadiness-v5",
    name: "Finding steadiness",
    theme: "Finding steadiness",
    themeType: "chakra",
    themeSub: "1 · Muladhara (root)",
    peakPose: "Eagle",
    showAnalysis: false,
    dates: [
      { date: daysFromToday(-15), notes: "Students were scattered today — this grounding theme landed. Held Eagle longer than planned, about 8 breaths each side. New cue: 'let your gaze soften as the body settles.' Keeping this." },
    ],
    createdAt: timestampDaysAgo(15),
    updatedAt: timestampDaysAgo(15),
    sections: [],
  },

  // 4 ── Kidney meridian: idea in progress, never taught — shows scratch pad + empty dot row
  {
    id: "seed-kidney-meridian-v5",
    name: "",
    theme: "Letting go of what we don't need",
    themeType: "meridian",
    themeSub: "Kidney",
    peakPose: "Pigeon",
    showAnalysis: false,
    notes: "Want to build around long holds and internal quiet. Maybe open with a 5-min seated meditation instead of the usual floor warm-up. Kidney meridian = will, fear, conservation of energy — let the poses do less, let stillness do more.",
    dates: [],
    createdAt: timestampDaysAgo(11),
    updatedAt: timestampDaysAgo(11),
    sections: [
      { id: "km-opening",  title: "Opening meditation", secondSide: false, poses: [] },
      {
        id: "km-surya", title: "Slow Surya A", secondSide: false, rounds: 2,
        poses: [
          p("km-s-1", "Mountain Pose"),
          p("km-s-2", "Extended Mountain"),
          p("km-s-3", "Standing Forward Fold"),
          p("km-s-4", "Half Lift"),
          p("km-s-5", "Plank"),
          p("km-s-6", "Chaturanga"),
          p("km-s-7", "Upward Dog"),
          p("km-s-8", "Downward Dog"),
        ],
      },
      { id: "km-standing", title: "Standing", secondSide: true, poses: [] },
      { id: "km-floor",    title: "Long holds", secondSide: true, poses: [] },
      { id: "km-close",    title: "Closing",    secondSide: false, poses: [] },
    ],
  },
  ];
}

export function loadSequences(): SequenceRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      if (examplesCleared()) return [];
      const seeded = buildSeedSequences().map(migrateRecord);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      localStorage.setItem(SEEDS_VERSION_KEY, String(SEEDS_VERSION));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    const storedVersion = Number(localStorage.getItem(SEEDS_VERSION_KEY) ?? 0);
    let records: SequenceRecord[] = parsed;
    if (storedVersion < SEEDS_VERSION) {
      // Remove old seeds, inject new ones at the front — unless the user
      // already cleared the examples; that choice outlives seed refreshes.
      records = (parsed as SequenceRecord[]).filter((r) => !OLD_SEED_IDS.has(r.id));
      if (!examplesCleared()) records = [...buildSeedSequences(), ...records];
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
