import {
  getBodyTargetLabel,
  getPoseMeta,
  type BodyTarget,
  type PoseType,
} from "./poses";
import { roundsMultiplier, type Section } from "./sequences";

export type AuditSeverity = "critical" | "warning" | "note" | "good";

export type AuditAction =
  | { kind: "add_constructive_rest"; label: string }
  | { kind: "add_savasana"; label: string }
  | { kind: "mark_both_sides"; label: string; sectionId: string };

export type SequenceAuditIssue = {
  id: string;
  severity: AuditSeverity;
  category: "Pacing" | "Safety" | "Balance" | "Theme" | "Architecture" | "Peak";
  title: string;
  detail: string;
  action?: AuditAction;
};

export type SequenceAuditReport = {
  score: number;
  summary: string;
  totalMinutes: number;
  standingMinutes: number;
  windDownMinutes: number;
  issues: SequenceAuditIssue[];
};

type SectionRole = "warmup" | "surya_a" | "standing" | "floor" | "winddown" | "close" | "other";

type ThemeFocus = {
  label: string;
  bodyTargets: BodyTarget[];
  poseTypes: PoseType[];
};

const SIDE_DEPENDENT_POSES = new Set([
  "Low Lunge",
  "Crescent",
  "Twisted Crescent",
  "Warrior I",
  "Warrior II",
  "Peaceful Warrior",
  "Devotional Warrior",
  "Warrior III",
  "Eagle",
  "Side Plank",
  "Figure 4 Balance",
  "Dancing Shiva",
  "Standing Splits",
  "Skandasana",
  "Tree",
  "Standing Hand-to-Big-Toe",
  "Triangle",
  "Extended Side Angle",
  "Half Moon",
  "Revolved Triangle",
  "Pyramid",
  "Lizard",
  "Pigeon",
  "Gomukhasana",
  "Janu Sirsasana",
  "Stargazer",
  "Seated Twist",
  "Thread the Needle",
]);

const THEME_FOCI: { keywords: string[]; focus: ThemeFocus }[] = [
  {
    keywords: ["shoulder", "heart", "chest"],
    focus: {
      label: "shoulder/heart opening",
      bodyTargets: ["shoulders", "chest", "upper_back"],
      poseTypes: ["backbend"],
    },
  },
  {
    keywords: ["hip", "hips"],
    focus: {
      label: "hip opening",
      bodyTargets: ["hip_flexors", "hip_rotators", "glutes"],
      poseTypes: ["hip_opener"],
    },
  },
  {
    keywords: ["twist", "revolve", "rotation"],
    focus: {
      label: "twists",
      bodyTargets: ["spine", "upper_back", "core"],
      poseTypes: ["twist"],
    },
  },
  {
    keywords: ["core", "midline", "fire"],
    focus: {
      label: "core",
      bodyTargets: ["core"],
      poseTypes: ["arm_balance"],
    },
  },
  {
    keywords: ["backbend", "back bend", "camel", "wheel"],
    focus: {
      label: "backbends",
      bodyTargets: ["chest", "hip_flexors", "upper_back", "shoulders"],
      poseTypes: ["backbend"],
    },
  },
  {
    keywords: ["balance", "steadiness", "stable"],
    focus: {
      label: "balance",
      bodyTargets: ["core", "ankles", "glutes"],
      poseTypes: ["balancing"],
    },
  },
];

function sectionMinutes(section: Section): number {
  const oneSide = section.poses.reduce((sum, pose) => sum + pose.minutes, 0);
  return oneSide * roundsMultiplier(section);
}

function isEmpty(section: Section): boolean {
  return section.poses.length === 0;
}

function roleForSection(section: Section): SectionRole {
  const title = section.title.toLowerCase();
  if (title.includes("warm")) return "warmup";
  if (title.includes("surya a")) return "surya_a";
  if (title.includes("floor")) return "floor";
  if (title.includes("wind")) return "winddown";
  if (title.includes("savasana") || title.includes("close")) return "close";
  if (
    title.includes("round") ||
    title.includes("neutral") ||
    title.includes("open") ||
    title.includes("midline") ||
    title.includes("surya b") ||
    title.includes("standing")
  ) {
    return "standing";
  }
  return "other";
}

export function hasPose(sections: Section[], poseName: string): boolean {
  return sections.some((section) => section.poses.some((pose) => pose.pose === poseName));
}

export type PoseLocation = { sectionIndex: number; poseIndex: number };

export function findLastPoseIndex(sections: Section[], poseName: string): PoseLocation | null {
  for (let sectionIndex = sections.length - 1; sectionIndex >= 0; sectionIndex--) {
    const poseIndex = sections[sectionIndex].poses.map((pose) => pose.pose).lastIndexOf(poseName);
    if (poseIndex !== -1) return { sectionIndex, poseIndex };
  }
  return null;
}

export function posesAfter(sections: Section[], location: PoseLocation): string[] {
  const out: string[] = [];
  for (let sectionIndex = location.sectionIndex; sectionIndex < sections.length; sectionIndex++) {
    const start = sectionIndex === location.sectionIndex ? location.poseIndex + 1 : 0;
    for (const pose of sections[sectionIndex].poses.slice(start)) {
      out.push(pose.pose);
    }
  }
  return out;
}

function inferThemeFocus(theme: string | undefined, peakPose: string | undefined): ThemeFocus | null {
  const text = `${theme ?? ""} ${peakPose ?? ""}`.toLowerCase();
  for (const candidate of THEME_FOCI) {
    if (candidate.keywords.some((keyword) => text.includes(keyword))) {
      return candidate.focus;
    }
  }

  if (!peakPose) return null;
  const peak = getPoseMeta(peakPose);
  if (!peak) return null;
  return {
    label: peak.pose.toLowerCase(),
    bodyTargets: peak.prerequisites?.length ? peak.prerequisites : peak.bodyTargets,
    poseTypes: [peak.poseType],
  };
}

function sectionSupportsFocus(section: Section, focus: ThemeFocus): boolean {
  return section.poses.some((pose) => {
    const meta = getPoseMeta(pose.pose);
    if (!meta) return false;
    return (
      meta.bodyTargets.some((target) => focus.bodyTargets.includes(target)) ||
      focus.poseTypes.includes(meta.poseType)
    );
  });
}

function humanFocusTargets(focus: ThemeFocus): string {
  if (focus.bodyTargets.length === 0) return focus.label;
  return focus.bodyTargets.map(getBodyTargetLabel).join(", ");
}

function normalizedRoundSignature(section: Section): string[] {
  return section.poses
    .map((pose) => pose.pose)
    .filter((pose) => pose !== "Vinyasa")
    .map((pose) => pose.toLowerCase());
}

function overlapRatio(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const rightSet = new Set(right);
  const overlap = left.filter((pose) => rightSet.has(pose)).length;
  return overlap / Math.max(left.length, right.length);
}

function addIssue(issues: SequenceAuditIssue[], issue: SequenceAuditIssue) {
  if (!issues.some((existing) => existing.id === issue.id)) issues.push(issue);
}

export function auditSequence({
  sections,
  theme,
  peakPose,
}: {
  sections: Section[];
  theme?: string;
  peakPose?: string;
}): SequenceAuditReport {
  const realSections = sections.filter((section) => !isEmpty(section));
  const roles = realSections.map(roleForSection);
  const totalMinutes = realSections.reduce((sum, section) => sum + sectionMinutes(section), 0);
  const standingMinutes = realSections.reduce((sum, section, index) => {
    return roles[index] === "standing" ? sum + sectionMinutes(section) : sum;
  }, 0);
  const windDownMinutes = realSections.reduce((sum, section, index) => {
    return roles[index] === "winddown" || roles[index] === "close" ? sum + sectionMinutes(section) : sum;
  }, 0);

  const issues: SequenceAuditIssue[] = [];

  if (totalMinutes > 48 && totalMinutes <= 65) {
    addIssue(issues, {
      id: "pacing-total-45",
      severity: "warning",
      category: "Pacing",
      title: "This is probably not a 45-minute class",
      detail: `${Math.round(totalMinutes)} minutes leaves almost no room for transitions, demos, or breath resets. For 45 minutes, cut from standing work first.`,
    });
  } else if (totalMinutes > 65) {
    addIssue(issues, {
      id: "pacing-total-60",
      severity: "critical",
      category: "Pacing",
      title: "This is long even for 60 minutes",
      detail: `${Math.round(totalMinutes)} minutes on paper will run over in the room. Choose the peak or the extra standing exploration, not both.`,
    });
  }

  if (standingMinutes > 22) {
    addIssue(issues, {
      id: "pacing-standing-heavy",
      severity: standingMinutes > 26 ? "critical" : "warning",
      category: "Pacing",
      title: "Standing work is carrying too much weight",
      detail: `${Math.round(standingMinutes)} minutes in standing work risks rushing the floor and close. Protect the landing by trimming one balance, bind, or optional open-hip pose.`,
    });
  }

  if (windDownMinutes > 0 && windDownMinutes < 6) {
    addIssue(issues, {
      id: "pacing-winddown-short",
      severity: "critical",
      category: "Pacing",
      title: "Wind-down is under-protected",
      detail: `${Math.round(windDownMinutes)} minutes for wind-down and savasana is thin, especially in a heated room. Cut standing work before cutting the close.`,
    });
  }

  if (!hasPose(realSections, "Savasana")) {
    addIssue(issues, {
      id: "safety-missing-savasana",
      severity: "critical",
      category: "Safety",
      title: "No savasana yet",
      detail: "The sequence has no final nervous-system landing. Add Savasana even if the rest of the class is tight.",
      action: { kind: "add_savasana", label: "Add Savasana" },
    });
  }

  const lastWheel = findLastPoseIndex(realSections, "Wheel");
  if (lastWheel) {
    const afterWheel = posesAfter(realSections, lastWheel);
    if (!afterWheel.includes("Constructive Rest")) {
      addIssue(issues, {
        id: "safety-wheel-reset",
        severity: "critical",
        category: "Safety",
        title: "Wheel needs a neutral reset",
        detail: "Going from Wheel straight into seated or cooling work is too abrupt for a heated class. Add Constructive Rest right after Wheel.",
        action: { kind: "add_constructive_rest", label: "Add reset" },
      });
    }
  }

  if (peakPose && !hasPose(realSections, peakPose)) {
    addIssue(issues, {
      id: "peak-missing",
      severity: "warning",
      category: "Peak",
      title: "Peak pose is selected but not placed",
      detail: `${peakPose} is set as the peak, but it does not appear in the sequence yet.`,
    });
  }

  for (const section of realSections) {
    const sideDependentCount = section.poses.filter((pose) => SIDE_DEPENDENT_POSES.has(pose.pose)).length;
    if (!section.secondSide && sideDependentCount >= 2) {
      addIssue(issues, {
        id: `balance-${section.id}`,
        severity: "warning",
        category: "Balance",
        title: `${section.title} looks one-sided`,
        detail: `${sideDependentCount} poses in this section usually need a second side. If this is a right/left flow, mark it as both sides.`,
        action: { kind: "mark_both_sides", label: "Mark both sides", sectionId: section.id },
      });
    }
  }

  const focus = inferThemeFocus(theme, peakPose);
  if (focus) {
    const missingRoles: string[] = [];
    const checks: { role: SectionRole; label: string }[] = [
      { role: "warmup", label: "warm-up" },
      { role: "floor", label: "floor" },
      { role: "winddown", label: "wind-down" },
    ];

    for (const check of checks) {
      const matchingSections = realSections.filter((_, index) => roles[index] === check.role);
      if (matchingSections.length > 0 && !matchingSections.some((section) => sectionSupportsFocus(section, focus))) {
        missingRoles.push(check.label);
      }
    }

    if (missingRoles.length > 0) {
      addIssue(issues, {
        id: "theme-throughline",
        severity: "note",
        category: "Theme",
        title: "Theme could echo in more places",
        detail: `For ${focus.label}, look for ${humanFocusTargets(focus)} in the ${missingRoles.join(", ")} too, not only in standing work.`,
      });
    }
  }

  const rounds = realSections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => section.title.toLowerCase().includes("round"));
  if (rounds.length >= 2) {
    const finalRound = rounds[rounds.length - 1];
    const previousRound = rounds[rounds.length - 2];
    const finalSignature = normalizedRoundSignature(finalRound.section);
    const previousSignature = normalizedRoundSignature(previousRound.section);
    const overlap = overlapRatio(finalSignature, previousSignature);

    if (overlap > 0.85 && sectionMinutes(finalRound.section) <= sectionMinutes(previousRound.section) + 0.25) {
      addIssue(issues, {
        id: "architecture-round-repeat",
        severity: "warning",
        category: "Architecture",
        title: "Final round may not escalate",
        detail: "The last two rounds look nearly identical. Round 3 should either add a meaningful pose, deepen the theme, or make the exit the peak.",
      });
    }

    const midlineAfterRounds = realSections
      .slice(finalRound.index + 1)
      .some((section) => section.title.toLowerCase().includes("midline"));
    if (midlineAfterRounds) {
      addIssue(issues, {
        id: "architecture-extra-close",
        severity: "warning",
        category: "Architecture",
        title: "Building rounds may have two endings",
        detail: "When the final round peaks, a separate midline close can make standing work feel like it will not end. Consider making the final round exit the close.",
      });
    }

    if (
      peakPose &&
      hasPose(realSections, peakPose) &&
      !finalRound.section.poses.some((pose) => pose.pose === peakPose)
    ) {
      addIssue(issues, {
        id: "architecture-peak-outside-final-round",
        severity: "note",
        category: "Architecture",
        title: "Peak sits outside the final round",
        detail: `If this is a building-rounds class, ${peakPose} will usually land best inside the final round or as its exit.`,
      });
    }
  }

  if (issues.length === 0 && realSections.length > 0) {
    addIssue(issues, {
      id: "all-clear",
      severity: "good",
      category: "Architecture",
      title: "Sequence is teachable",
      detail: "The timing, safety checks, bilateral structure, and theme pass the current audit rules.",
    });
  }

  const penalty = issues.reduce((sum, issue) => {
    if (issue.severity === "critical") return sum + 22;
    if (issue.severity === "warning") return sum + 12;
    if (issue.severity === "note") return sum + 4;
    return sum;
  }, 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const summary =
    criticalCount > 0
      ? `${criticalCount} must-fix issue${criticalCount === 1 ? "" : "s"}`
      : warningCount > 0
        ? `${warningCount} thing${warningCount === 1 ? "" : "s"} to tighten`
        : "Ready to teach";

  return {
    score,
    summary,
    totalMinutes,
    standingMinutes,
    windDownMinutes,
    issues,
  };
}
