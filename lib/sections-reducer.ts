import { generateId, normalizePoseItem, type PoseItem, type Section } from "./sequences";
import { SECTION_TEMPLATES, sectionFromTemplate } from "./section-templates";
import { insertPoseBeforePeak } from "./peak-readiness";
import { findLastPoseIndex, hasPose, posesAfter, type AuditAction } from "./sequence-audit";

/**
 * Every edit the builder can make to a sequence's sections, as one reducer.
 * The UI dispatches actions; all list surgery lives here where it can be
 * unit-tested. Side effects (remembering cues, opening modals, saving) stay
 * in the page — the reducer only computes the next sections array.
 */
export type SectionsAction =
  | { type: "hydrate"; sections: Section[] }
  | { type: "add_section" }
  | { type: "delete_section"; sectionId: string }
  | { type: "move_section"; sectionId: string; dir: -1 | 1 }
  | { type: "update_title"; sectionId: string; title: string }
  | { type: "toggle_second_side"; sectionId: string }
  | { type: "set_rounds"; sectionId: string; rounds: number }
  | { type: "append_template"; sectionId: string; templateId: string }
  | { type: "add_pose"; sectionId: string; pose: string; afterPoseId?: string }
  | { type: "add_poses"; sectionId: string; poses: string[] }
  | { type: "move_pose"; sectionId: string; poseId: string; dir: -1 | 1 }
  | { type: "remove_pose"; sectionId: string; poseId: string }
  | { type: "set_breaths"; poseId: string; breaths: number }
  | { type: "set_cue"; poseId: string; cue: string }
  | { type: "toggle_theme_pose"; poseId: string }
  | { type: "add_prep_before_peak"; pose: string; peakPose?: string }
  | { type: "apply_audit_action"; action: AuditAction };

function makePoseItem(pose: string): PoseItem {
  return normalizePoseItem({ id: generateId(), pose, duration: "", minutes: 0 });
}

function mapPoses(
  sections: Section[],
  poseId: string,
  fn: (pose: PoseItem) => PoseItem,
): Section[] {
  return sections.map((s) => ({
    ...s,
    poses: s.poses.map((p) => (p.id === poseId ? fn(p) : p)),
  }));
}

/** Nudge a pose one slot up/down, hopping into the adjacent non-empty section at the ends. */
function movePose(sections: Section[], sectionId: string, poseId: string, dir: -1 | 1): Section[] {
  const si = sections.findIndex((s) => s.id === sectionId);
  if (si === -1) return sections;
  const pi = sections[si].poses.findIndex((p) => p.id === poseId);
  if (pi === -1) return sections;

  const next = sections.map((s) => ({ ...s, poses: [...s.poses] }));
  const src = next[si];

  if (dir === -1) {
    if (pi > 0) {
      [src.poses[pi - 1], src.poses[pi]] = [src.poses[pi], src.poses[pi - 1]];
    } else {
      let ti = -1;
      for (let k = si - 1; k >= 0; k--) if (next[k].poses.length > 0) { ti = k; break; }
      if (ti === -1) return sections;
      const [moved] = src.poses.splice(pi, 1);
      next[ti].poses.push(moved);
    }
  } else {
    if (pi < src.poses.length - 1) {
      [src.poses[pi + 1], src.poses[pi]] = [src.poses[pi], src.poses[pi + 1]];
    } else {
      let ti = -1;
      for (let k = si + 1; k < next.length; k++) if (next[k].poses.length > 0) { ti = k; break; }
      if (ti === -1) return sections;
      const [moved] = src.poses.splice(pi, 1);
      next[ti].poses.unshift(moved);
    }
  }

  return next;
}

function applyAuditAction(sections: Section[], action: AuditAction): Section[] {
  if (action.kind === "mark_both_sides") {
    return sections.map((section) =>
      section.id === action.sectionId ? { ...section, secondSide: true } : section,
    );
  }

  if (action.kind === "add_savasana") {
    if (hasPose(sections, "Savasana")) return sections;
    // "clos" matches both "Close" and "Closing" (the canonical section title).
    const closeIndex = sections.findIndex((section) =>
      /clos|savasana/i.test(section.title),
    );
    const newPose = makePoseItem("Savasana");
    if (closeIndex !== -1) {
      return sections.map((section, index) =>
        index === closeIndex
          ? { ...section, poses: [...section.poses, newPose] }
          : section,
      );
    }
    const trailingEmptyIndex = sections.findIndex((section, index) =>
      index === sections.length - 1 && section.poses.length === 0,
    );
    const insertIndex = trailingEmptyIndex === -1 ? sections.length : trailingEmptyIndex;
    const savasanaSection: Section = {
      id: generateId(),
      title: "Savasana",
      secondSide: false,
      poses: [newPose],
    };
    return [
      ...sections.slice(0, insertIndex),
      savasanaSection,
      ...sections.slice(insertIndex),
    ];
  }

  if (action.kind === "add_constructive_rest") {
    const lastWheel = findLastPoseIndex(sections, "Wheel");
    if (!lastWheel) return sections;
    if (posesAfter(sections, lastWheel).includes("Constructive Rest")) return sections;

    const newPose = makePoseItem("Constructive Rest");
    return sections.map((section, sectionIndex) => {
      if (sectionIndex !== lastWheel.sectionIndex) return section;
      const nextPoses = [...section.poses];
      nextPoses.splice(lastWheel.poseIndex + 1, 0, newPose);
      return { ...section, poses: nextPoses };
    });
  }

  return sections;
}

export function sectionsReducer(sections: Section[], action: SectionsAction): Section[] {
  switch (action.type) {
    case "hydrate":
      return action.sections;

    case "add_section":
      return [
        ...sections,
        { id: generateId(), title: "New section", secondSide: false, poses: [] },
      ];

    case "delete_section":
      return sections.filter((s) => s.id !== action.sectionId);

    case "move_section": {
      const idx = sections.findIndex((s) => s.id === action.sectionId);
      if (idx === -1) return sections;
      const newIdx = idx + action.dir;
      if (newIdx < 0 || newIdx >= sections.length) return sections;
      const next = [...sections];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    }

    case "update_title":
      return sections.map((s) =>
        s.id === action.sectionId ? { ...s, title: action.title } : s,
      );

    case "toggle_second_side":
      return sections.map((s) =>
        s.id === action.sectionId ? { ...s, secondSide: !s.secondSide } : s,
      );

    case "set_rounds":
      return sections.map((s) =>
        s.id === action.sectionId
          ? { ...s, rounds: action.rounds > 1 ? action.rounds : undefined }
          : s,
      );

    case "append_template": {
      const template = SECTION_TEMPLATES.find((t) => t.id === action.templateId);
      if (!template) return sections;
      const filled = sectionFromTemplate(template);
      return sections.map((s) =>
        s.id === action.sectionId ? { ...s, poses: [...s.poses, ...filled.poses] } : s,
      );
    }

    case "add_pose": {
      const newPose = makePoseItem(action.pose);
      return sections.map((s) => {
        if (s.id !== action.sectionId) return s;
        if (action.afterPoseId) {
          const idx = s.poses.findIndex((p) => p.id === action.afterPoseId);
          const next = [...s.poses];
          next.splice(idx + 1, 0, newPose);
          return { ...s, poses: next };
        }
        return { ...s, poses: [...s.poses, newPose] };
      });
    }

    case "add_poses": {
      const newPoses = action.poses.map(makePoseItem);
      return sections.map((s) =>
        s.id === action.sectionId ? { ...s, poses: [...s.poses, ...newPoses] } : s,
      );
    }

    case "move_pose":
      return movePose(sections, action.sectionId, action.poseId, action.dir);

    case "remove_pose":
      return sections.map((s) =>
        s.id === action.sectionId
          ? { ...s, poses: s.poses.filter((p) => p.id !== action.poseId) }
          : s,
      );

    case "set_breaths":
      return mapPoses(sections, action.poseId, (p) =>
        normalizePoseItem({ ...p, breaths: action.breaths }),
      );

    case "set_cue":
      return mapPoses(sections, action.poseId, (p) => ({
        ...p,
        cue: action.cue || undefined,
      }));

    case "toggle_theme_pose":
      return mapPoses(sections, action.poseId, (p) => ({
        ...p,
        themePose: p.themePose ? undefined : true,
      }));

    case "add_prep_before_peak":
      return insertPoseBeforePeak(sections, action.pose, action.peakPose);

    case "apply_audit_action":
      return applyAuditAction(sections, action.action);
  }
}
