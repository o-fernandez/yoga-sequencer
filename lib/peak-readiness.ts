import { poseLibrary, getPoseMeta, type BodyTarget } from "./poses";
import { generateId, normalizePoseItem, type Section } from "./sequences";

export type PeakReadiness = {
  peak: string;
  /** Body areas this peak depends on (explicit prerequisites, or its own targets as fallback). */
  depends: BodyTarget[];
  warmed: BodyTarget[];
  unwarmed: BodyTarget[];
  /** Up to three prep poses per unwarmed area. */
  suggestionsByArea: { area: BodyTarget; poses: string[] }[];
};

/**
 * Compute whether the sequence warms up the areas its peak pose depends on.
 * Returns null when there's nothing to nag about — no peak meta, or a peak with
 * no dependent areas (Savasana, Mountain).
 */
export function computePeakReadiness(
  sections: Section[],
  peakPose: string,
): PeakReadiness | null {
  const meta = getPoseMeta(peakPose);
  if (!meta) return null;

  const depends =
    meta.prerequisites && meta.prerequisites.length > 0
      ? meta.prerequisites
      : meta.bodyTargets;
  if (depends.length === 0) return null;

  // Walk in running order; only poses before the first placed peak count as warming.
  // If the peak isn't placed yet, every pose counts.
  const warmedSet = new Set<BodyTarget>();
  walk: for (const section of sections) {
    for (const pose of section.poses) {
      if (pose.pose === peakPose) break walk;
      getPoseMeta(pose.pose)?.bodyTargets.forEach((t) => warmedSet.add(t));
    }
  }

  const warmed = depends.filter((d) => warmedSet.has(d));
  const unwarmed = depends.filter((d) => !warmedSet.has(d));

  return {
    peak: peakPose,
    depends,
    warmed,
    unwarmed,
    suggestionsByArea: unwarmed.map((area) => ({ area, poses: suggestPosesForArea(area) })),
  };
}

/**
 * Prep poses that warm a given area. Favors heating/warming poses; never proposes
 * cooldown (cooling) or resting poses. Each pose appears once even if the library
 * lists it in multiple categories.
 */
function suggestPosesForArea(area: BodyTarget): string[] {
  const seen = new Set<string>();
  const candidates: { pose: string; rank: number }[] = [];
  for (const cat of poseLibrary) {
    for (const p of cat.poses) {
      if (seen.has(p.pose)) continue;
      if (!p.bodyTargets.includes(area)) continue;
      if (p.energy === "cooling" || p.bodyRegion === "rest") continue;
      seen.add(p.pose);
      const rank = p.energy === "heating" ? 0 : p.energy === "warming" ? 1 : 2;
      candidates.push({ pose: p.pose, rank });
    }
  }
  candidates.sort((a, b) => a.rank - b.rank);
  return candidates.slice(0, 3).map((c) => c.pose);
}

/**
 * Insert a prep pose just before the peak pose so it lands in the warm-up window.
 * If the peak isn't placed (or none is chosen), append to the end of the build.
 */
export function insertPoseBeforePeak(
  sections: Section[],
  poseName: string,
  peakPose: string | undefined,
): Section[] {
  const newPose = normalizePoseItem({ id: generateId(), pose: poseName, duration: "", minutes: 0 });

  if (peakPose) {
    for (let si = 0; si < sections.length; si++) {
      const idx = sections[si].poses.findIndex((p) => p.pose === peakPose);
      if (idx !== -1) {
        return sections.map((s, i) =>
          i === si
            ? { ...s, poses: [...s.poses.slice(0, idx), newPose, ...s.poses.slice(idx)] }
            : s,
        );
      }
    }
  }

  // Peak not placed: append to the last section that already has poses.
  let target = -1;
  sections.forEach((s, i) => {
    if (s.poses.length > 0) target = i;
  });
  if (target === -1) target = sections.length - 1;
  if (target < 0) return sections;
  return sections.map((s, i) =>
    i === target ? { ...s, poses: [...s.poses, newPose] } : s,
  );
}
