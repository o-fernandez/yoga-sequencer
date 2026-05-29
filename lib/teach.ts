import type { Section } from "./sequences";
import { getPoseMeta, type BodyRegion } from "./poses";

/**
 * Teach mode models the running order as a single flat, ordered list of "steps":
 * sections flattened, empty sections dropped, and both-sides sections already
 * expanded into two passes. The list view renders every step; a future focus
 * mode (one pose at a time) renders one step at a time from the same list.
 */
export type TeachStep = {
  /** Unique within the sequence (pose id + side suffix). */
  id: string;
  pose: string;
  sanskrit?: string;
  duration: string;
  minutes: number;
  cue?: string;
  modifications?: string[];
  bodyRegion?: BodyRegion;
  /** Identifies the section+side pass this step belongs to (for grouping). */
  passId: string;
  sectionTitle: string;
  /** "First side" / "Second side" for both-sides sections; undefined otherwise. */
  sideLabel?: string;
};

/** A contiguous run of steps sharing one section header + side label. */
export type TeachPass = {
  id: string;
  sectionTitle: string;
  sideLabel?: string;
  steps: TeachStep[];
  minutes: number;
};

function stepsForSide(
  section: Section,
  passId: string,
  sideLabel: string | undefined,
): TeachStep[] {
  return section.poses.map((p) => {
    const meta = getPoseMeta(p.pose);
    return {
      id: `${passId}::${p.id}`,
      pose: p.pose,
      sanskrit: meta?.sanskrit,
      duration: p.duration,
      minutes: p.minutes,
      cue: p.cue,
      modifications: meta?.modifications,
      bodyRegion: meta?.bodyRegion,
      passId,
      sectionTitle: section.title,
      sideLabel,
    };
  });
}

/**
 * Flatten sections into the ordered teaching steps. Empty sections (including
 * the builder's trailing empty section) are skipped. Both-sides sections are
 * duplicated into two labelled passes so scroll position and totals reflect
 * what actually happens in the room.
 */
export function buildTeachSteps(sections: Section[]): TeachStep[] {
  const steps: TeachStep[] = [];
  for (const section of sections) {
    if (section.poses.length === 0) continue;
    if (section.secondSide) {
      steps.push(...stepsForSide(section, `${section.id}::a`, "First side"));
      steps.push(...stepsForSide(section, `${section.id}::b`, "Second side"));
    } else {
      steps.push(...stepsForSide(section, section.id, undefined));
    }
  }
  return steps;
}

/** Group the flat steps back into passes for rendering section headers + subtotals. */
export function groupIntoPasses(steps: TeachStep[]): TeachPass[] {
  const passes: TeachPass[] = [];
  for (const step of steps) {
    let pass = passes[passes.length - 1];
    if (!pass || pass.id !== step.passId) {
      pass = {
        id: step.passId,
        sectionTitle: step.sectionTitle,
        sideLabel: step.sideLabel,
        steps: [],
        minutes: 0,
      };
      passes.push(pass);
    }
    pass.steps.push(step);
    pass.minutes += step.minutes;
  }
  return passes;
}

export function totalTeachMinutes(steps: TeachStep[]): number {
  return steps.reduce((sum, s) => sum + s.minutes, 0);
}
