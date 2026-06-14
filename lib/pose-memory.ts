import { isTaught, type SequenceRecord } from "./sequences";

export type PoseMemory = {
  /** pose name → most recent date (YYYY-MM-DD) a taught class contained it */
  lastTaught: Map<string, string>;
  /** how many classes have at least one taught date — memory stays quiet until there's history */
  taughtClassCount: number;
};

/**
 * Walk every class and remember, per pose, the most recent date the teacher
 * actually taught a class containing it. Planned-but-not-yet-taught classes
 * don't count — memory reflects what's been taught, not what's on the calendar.
 */
export function buildPoseMemory(sequences: SequenceRecord[]): PoseMemory {
  const lastTaught = new Map<string, string>();
  let taughtClassCount = 0;
  for (const seq of sequences) {
    const taughtDates = seq.dates.filter(isTaught).map((e) => e.date);
    if (taughtDates.length === 0) continue;
    taughtClassCount++;
    const latest = taughtDates.reduce((a, b) => (a > b ? a : b));
    const seen = new Set<string>();
    for (const section of seq.sections) {
      for (const pose of section.poses) {
        if (seen.has(pose.pose)) continue;
        seen.add(pose.pose);
        const prev = lastTaught.get(pose.pose);
        if (!prev || latest > prev) lastTaught.set(pose.pose, latest);
      }
    }
  }
  return { lastTaught, taughtClassCount };
}

/** Under this, a pose counts as in regular rotation and memory stays silent. */
const COLD_AFTER_DAYS = 56; // ~8 weeks

function daysSince(iso: string): number {
  const then = new Date(`${iso}T12:00:00`).getTime();
  return Math.floor((Date.now() - then) / 86_400_000);
}

export type PoseMemoryNote = { text: string; tone: "cold" | "new" };

/**
 * The quiet memory line for a pose, or null when it should stay silent.
 * Silent for poses in regular rotation. Speaks only for the two notable cases:
 * a pose gone cold, and (in focused search only) a pose never taught — so the
 * browse-everything list doesn't fill with identical "new" labels.
 */
export function poseMemoryNote(
  poseName: string,
  memory: PoseMemory,
  inSearch: boolean,
): PoseMemoryNote | null {
  if (memory.taughtClassCount === 0) return null;
  const last = memory.lastTaught.get(poseName);
  if (last) {
    const days = daysSince(last);
    if (days < COLD_AFTER_DAYS) return null;
    const months = Math.round(days / 30.4);
    const text =
      months >= 12
        ? "Haven't taught this in over a year"
        : `Haven't taught this in ${months} months`;
    return { text, tone: "cold" };
  }
  if (inSearch) return { text: "New to your classes", tone: "new" };
  return null;
}
