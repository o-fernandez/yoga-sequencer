import { poseLibrary } from "./poses";
import { normalizePoseItem, generateId, type Section } from "./sequences";

export type SectionTemplate = {
  id: string;
  name: string;
  defaultTitle: string;
  defaultRounds: number;
  poseNames: string[];
};

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    id: "surya-a",
    name: "Surya A",
    defaultTitle: "Surya A",
    defaultRounds: 4,
    // Full round trip: descent + return to Mountain for accurate timing
    poseNames: [
      "Mountain Pose", "Extended Mountain", "Standing Forward Fold", "Half Lift",
      "Plank", "Chaturanga", "Upward Dog", "Downward Dog",
      "Half Lift", "Standing Forward Fold", "Extended Mountain", "Mountain Pose",
    ],
  },
  {
    id: "surya-b",
    name: "Surya B",
    defaultTitle: "Surya B",
    defaultRounds: 2,
    // Both sides of Warrior I explicit — Surya B runs right then left in one continuous flow.
    // secondSide is false on the resulting section.
    poseNames: [
      "Chair", "Standing Forward Fold", "Half Lift", "Vinyasa",
      "Warrior I", "Vinyasa",
      "Warrior I", "Vinyasa",
      "Standing Forward Fold", "Half Lift", "Chair", "Mountain Pose",
    ],
  },
  {
    id: "opening",
    name: "Opening",
    defaultTitle: "Opening",
    defaultRounds: 1,
    poseNames: ["Centering Breath", "Cat/Cow", "Child's Pose", "Downward Dog"],
  },
  {
    id: "floor",
    name: "Floor",
    defaultTitle: "Floor",
    defaultRounds: 1,
    // Locust appears twice — cued twice in practice, so listing it twice gives accurate timing
    poseNames: [
      "Plank", "Forearm Plank", "Sphinx", "Locust", "Locust",
      "Bow", "Bridge", "Wheel", "Supta Baddhakonasana", "Downward Dog",
    ],
  },
  {
    id: "closing",
    name: "Closing",
    defaultTitle: "Closing",
    defaultRounds: 1,
    poseNames: ["Seated Forward Fold", "Supine Twist", "Happy Baby", "Savasana"],
  },
  {
    id: "vinyasa",
    name: "Vinyasa",
    defaultTitle: "Vinyasa",
    defaultRounds: 1,
    poseNames: ["Plank", "Chaturanga", "Upward Dog", "Downward Dog"],
  },
];

/** Build a fully normalized Section from a template. */
export function sectionFromTemplate(template: SectionTemplate): Section {
  const allPoses = poseLibrary.flatMap((cat) => cat.poses);
  const poseMap = new Map(allPoses.map((p) => [p.pose, p]));

  return {
    id: generateId(),
    title: template.defaultTitle,
    secondSide: false,
    rounds: template.defaultRounds > 1 ? template.defaultRounds : undefined,
    poses: template.poseNames
      .map((name) => poseMap.get(name))
      .filter(Boolean)
      .map((meta) =>
        normalizePoseItem({
          id: generateId(),
          pose: meta!.pose,
          duration: meta!.duration,
          minutes: meta!.minutes,
        })
      ),
  };
}
