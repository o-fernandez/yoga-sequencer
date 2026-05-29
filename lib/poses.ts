export type Chakra =
  | "root" | "sacral" | "solar" | "heart"
  | "throat" | "third_eye" | "crown";

export type BodyTarget =
  | "hip_flexors" | "hip_rotators" | "hamstrings" | "quads" | "glutes"
  | "core" | "lower_back" | "upper_back" | "shoulders" | "chest"
  | "spine" | "ankles" | "wrists" | "arms" | "calves";

export type PoseType =
  | "standing" | "backbend" | "forward_fold" | "twist"
  | "inversion" | "arm_balance" | "hip_opener"
  | "balancing" | "seated" | "supine" | "prone";

export type EnergyQuality = "heating" | "warming" | "cooling" | "grounding" | "neutral";

export type BodyRegion = "lower_body" | "core" | "upper_body" | "full_body" | "rest";

export type PoseMeta = {
  pose: string;
  duration: string;
  minutes: number;
  chakras: Chakra[];
  bodyTargets: BodyTarget[];
  poseType: PoseType;
  energy: EnergyQuality;
  bodyRegion: BodyRegion;
  prerequisites?: BodyTarget[];
  modifications?: string[];
};

export const poseLibrary: { category: string; poses: PoseMeta[] }[] = [
  {
    category: "Warm-up",
    poses: [
      {
        pose: "Centering Breath", duration: "2 min", minutes: 2,
        chakras: ["crown"], bodyTargets: [], poseType: "seated", energy: "grounding",
        bodyRegion: "rest",
      },
      {
        pose: "Cat/Cow", duration: "2 min", minutes: 2,
        chakras: ["sacral", "solar"], bodyTargets: ["spine", "lower_back"], poseType: "prone", energy: "warming",
        bodyRegion: "full_body",
      },
      {
        pose: "Child's Pose", duration: "1 min", minutes: 1,
        chakras: ["root", "third_eye"], bodyTargets: ["hip_rotators", "lower_back"], poseType: "prone", energy: "grounding",
        bodyRegion: "rest",
      },
      {
        pose: "Downward Dog", duration: "1 min", minutes: 1,
        chakras: ["root", "third_eye"], bodyTargets: ["hamstrings", "calves", "shoulders", "upper_back"], poseType: "inversion", energy: "neutral",
        bodyRegion: "full_body",
        modifications: ["Bend knees generously to find length in the spine", "Pedal the heels alternately to warm the calves", "Puppy pose (forearms down) for tight shoulders"],
      },
      {
        pose: "Beast", duration: "1 min", minutes: 1,
        chakras: ["solar", "root"], bodyTargets: ["core", "wrists", "shoulders"], poseType: "prone", energy: "warming",
        bodyRegion: "core",
        modifications: ["Keep knees hovering just 1 inch off the floor", "Wrist discomfort: fists or forearm variation"],
      },
    ],
  },
  {
    category: "Surya A",
    poses: [
      {
        pose: "Mountain Pose", duration: "30 sec", minutes: 0.5,
        chakras: ["root"], bodyTargets: [], poseType: "standing", energy: "grounding",
        bodyRegion: "full_body",
      },
      {
        pose: "Standing Forward Fold", duration: "30 sec", minutes: 0.5,
        chakras: ["root", "sacral"], bodyTargets: ["hamstrings", "lower_back"], poseType: "forward_fold", energy: "cooling",
        bodyRegion: "lower_body",
        modifications: ["Bend knees deeply", "Hands to blocks"],
      },
      {
        pose: "Half Lift", duration: "30 sec", minutes: 0.5,
        chakras: ["root", "solar"], bodyTargets: ["hamstrings", "core"], poseType: "forward_fold", energy: "warming",
        bodyRegion: "lower_body",
        modifications: ["Hands to shins or blocks", "Flat-back focus over hamstring length"],
      },
      {
        pose: "Plank", duration: "30 sec", minutes: 0.5,
        chakras: ["solar"], bodyTargets: ["core", "shoulders", "wrists", "arms"], poseType: "prone", energy: "heating",
        bodyRegion: "core",
        modifications: ["Knees down", "Wrist discomfort: forearm plank"],
      },
      {
        pose: "Chaturanga", duration: "30 sec", minutes: 0.5,
        chakras: ["solar", "heart"], bodyTargets: ["core", "shoulders", "chest", "arms", "wrists"], poseType: "prone", energy: "heating",
        bodyRegion: "upper_body",
        modifications: ["Lower all the way to belly", "Knees-down chaturanga", "Use a block under the chest"],
      },
      {
        pose: "Upward Dog", duration: "30 sec", minutes: 0.5,
        chakras: ["heart"], bodyTargets: ["chest", "upper_back", "hip_flexors"], poseType: "backbend", energy: "heating",
        bodyRegion: "upper_body",
        modifications: ["Cobra (stay lower, thighs on floor)", "Roll over toes one foot at a time"],
      },
    ],
  },
  {
    category: "Surya B",
    poses: [
      {
        pose: "Chair", duration: "30 sec", minutes: 0.5,
        chakras: ["root", "solar"], bodyTargets: ["quads", "glutes", "core"], poseType: "standing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Less depth in the bend", "Arms to heart center if shoulders are tight"],
      },
      {
        pose: "Warrior I", duration: "1 min", minutes: 1,
        chakras: ["root", "solar"], bodyTargets: ["hip_flexors", "quads", "glutes", "upper_back"], poseType: "standing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Shorten stance for tight hips", "Back heel lifted (crescent variation)"],
      },
      {
        pose: "Vinyasa", duration: "30 sec", minutes: 0.5,
        chakras: ["solar", "heart"], bodyTargets: ["core", "shoulders", "chest"], poseType: "prone", energy: "heating",
        bodyRegion: "full_body",
        modifications: ["Skip to child's pose anytime", "Knees-down chaturanga"],
      },
    ],
  },
  {
    category: "Neutral Hips",
    poses: [
      {
        pose: "Low Lunge", duration: "1 min", minutes: 1,
        chakras: ["root", "sacral"], bodyTargets: ["hip_flexors", "quads"], poseType: "standing", energy: "warming",
        bodyRegion: "lower_body",
        modifications: ["Blanket under back knee", "Hands to blocks"],
      },
      {
        pose: "Crescent", duration: "1 min", minutes: 1,
        chakras: ["solar", "sacral"], bodyTargets: ["hip_flexors", "quads", "core"], poseType: "standing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Hands to hips to reduce upper body demand", "Shorten stance"],
      },
      {
        pose: "Twisted Crescent", duration: "1 min", minutes: 1,
        chakras: ["solar"], bodyTargets: ["hip_flexors", "core", "upper_back"], poseType: "twist", energy: "heating",
        bodyRegion: "full_body",
        modifications: ["Prayer hands at heart instead of open twist", "Back knee down"],
      },
      {
        pose: "Warrior III", duration: "1 min", minutes: 1,
        chakras: ["root", "solar"], bodyTargets: ["hamstrings", "glutes", "core"], poseType: "balancing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Hands to hips", "Fingertips to blocks", "Stand near a wall for balance"],
      },
      {
        pose: "Eagle", duration: "1 min", minutes: 1,
        chakras: ["third_eye", "sacral"], bodyTargets: ["hip_rotators", "shoulders", "upper_back"], poseType: "balancing", energy: "grounding",
        bodyRegion: "lower_body",
        modifications: ["Cross legs without wrapping (figure 4 shape)", "Eagle arms only (seated)"],
      },
      {
        pose: "Side Plank", duration: "30 sec", minutes: 0.5,
        chakras: ["solar"], bodyTargets: ["core", "shoulders", "wrists"], poseType: "arm_balance", energy: "heating",
        bodyRegion: "core",
        modifications: ["Bottom knee down", "Forearm side plank"],
      },
      {
        pose: "Figure 4 Balance", duration: "1 min", minutes: 1,
        chakras: ["root", "sacral"], bodyTargets: ["hip_rotators", "glutes"], poseType: "balancing", energy: "grounding",
        bodyRegion: "lower_body",
        modifications: ["Hand to wall for balance", "Seated figure 4 instead"],
      },
      {
        pose: "Dancing Shiva", duration: "1 min", minutes: 1,
        chakras: ["root"], bodyTargets: ["hip_flexors", "quads"], poseType: "balancing", energy: "grounding",
        bodyRegion: "lower_body",
        modifications: ["Fingertips to wall", "Reduce the knee lift"],
      },
      {
        pose: "Standing Splits", duration: "1 min", minutes: 1,
        chakras: ["root", "sacral"], bodyTargets: ["hamstrings", "hip_flexors"], poseType: "forward_fold", energy: "neutral",
        bodyRegion: "lower_body",
        modifications: ["Hands to blocks", "Keep lifted leg low — focus on hip alignment"],
      },
      {
        pose: "Skandasana", duration: "1 min", minutes: 1,
        chakras: ["root", "sacral"], bodyTargets: ["hip_rotators", "hamstrings", "quads"], poseType: "standing", energy: "cooling",
        bodyRegion: "lower_body",
        modifications: ["Stay higher if ankles are tight", "Hands to blocks", "Heel elevated on a blanket"],
      },
    ],
  },
  {
    category: "Open Hips",
    poses: [
      {
        pose: "Devotional Warrior", duration: "1 min", minutes: 1,
        chakras: ["sacral", "heart"], bodyTargets: ["hip_rotators", "chest"], poseType: "standing", energy: "warming",
        bodyRegion: "lower_body",
      },
      {
        pose: "Warrior II", duration: "1 min", minutes: 1,
        chakras: ["sacral"], bodyTargets: ["hip_rotators", "quads"], poseType: "standing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Shorten stance", "Reduce depth of front knee bend"],
      },
      {
        pose: "Peaceful Warrior", duration: "45 sec", minutes: 0.75,
        chakras: ["sacral", "heart"], bodyTargets: ["hip_rotators", "chest"], poseType: "standing", energy: "warming",
        bodyRegion: "lower_body",
      },
      {
        pose: "Triangle", duration: "1 min", minutes: 1,
        chakras: ["sacral", "heart"], bodyTargets: ["hamstrings", "hip_rotators", "chest"], poseType: "standing", energy: "neutral",
        bodyRegion: "lower_body",
        modifications: ["Block under bottom hand", "Bend front knee slightly"],
      },
      {
        pose: "Extended Side Angle", duration: "1 min", minutes: 1,
        chakras: ["sacral", "solar"], bodyTargets: ["hip_rotators", "core"], poseType: "standing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Forearm to thigh instead of hand to floor", "Block under bottom hand"],
      },
      {
        pose: "Half Moon", duration: "1 min", minutes: 1,
        chakras: ["sacral", "third_eye"], bodyTargets: ["hip_rotators", "hamstrings"], poseType: "balancing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Block under bottom hand", "Stand near a wall", "Keep top hand on hip"],
      },
      {
        pose: "Revolved Triangle", duration: "1 min", minutes: 1,
        chakras: ["solar", "sacral"], bodyTargets: ["hamstrings", "hip_rotators", "upper_back"], poseType: "twist", energy: "neutral",
        bodyRegion: "full_body",
        modifications: ["Block under bottom hand", "Shorten stance", "Bent front knee"],
      },
      {
        pose: "Prasarita", duration: "1 min", minutes: 1,
        chakras: ["root", "sacral"], bodyTargets: ["hamstrings", "hip_rotators"], poseType: "forward_fold", energy: "cooling",
        bodyRegion: "lower_body",
        modifications: ["Hands to blocks", "Slight knee bend"],
      },
      {
        pose: "Lizard", duration: "1 min", minutes: 1,
        chakras: ["sacral"], bodyTargets: ["hip_flexors", "hip_rotators"], poseType: "hip_opener", energy: "warming",
        bodyRegion: "lower_body",
        modifications: ["Back knee down", "Forearms to mat or block", "Blanket under back knee"],
      },
      {
        pose: "Pyramid", duration: "1 min", minutes: 1,
        chakras: ["root", "sacral"], bodyTargets: ["hamstrings", "hip_flexors"], poseType: "forward_fold", energy: "cooling",
        bodyRegion: "lower_body",
        modifications: ["Blocks under hands", "Micro-bend in front knee"],
      },
    ],
  },
  {
    category: "Midline Close",
    poses: [
      {
        pose: "Chair", duration: "30 sec", minutes: 0.5,
        chakras: ["root", "solar"], bodyTargets: ["quads", "glutes", "core"], poseType: "standing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Less depth in the bend", "Arms to heart center"],
      },
      {
        pose: "Revolved Chair", duration: "30 sec", minutes: 0.5,
        chakras: ["solar"], bodyTargets: ["core", "upper_back", "quads"], poseType: "twist", energy: "heating",
        bodyRegion: "full_body",
        modifications: ["Prayer hands only (no open twist)", "Reduce chair depth"],
      },
      {
        pose: "Malasana", duration: "1 min", minutes: 1,
        chakras: ["sacral", "root"], bodyTargets: ["hip_rotators", "ankles"], poseType: "standing", energy: "grounding",
        bodyRegion: "lower_body",
        modifications: ["Heels on a rolled blanket", "Sit on a block"],
      },
      {
        pose: "Crow", duration: "1 min", minutes: 1,
        chakras: ["solar", "third_eye"], bodyTargets: ["core", "wrists", "shoulders"],
        poseType: "arm_balance", energy: "heating",
        bodyRegion: "upper_body",
        prerequisites: ["core", "wrists"],
        modifications: ["Feet on a block to reduce the lift", "Practice tipping weight forward without leaving the floor", "One foot lift at a time"],
      },
    ],
  },
  {
    category: "Floor",
    poses: [
      {
        pose: "Forearm Plank", duration: "30 sec", minutes: 0.5,
        chakras: ["solar"], bodyTargets: ["core", "shoulders"], poseType: "prone", energy: "heating",
        bodyRegion: "core",
        modifications: ["Knees down", "Reduce to 15 seconds"],
      },
      {
        pose: "Sphinx", duration: "1 min", minutes: 1,
        chakras: ["heart"], bodyTargets: ["chest", "upper_back"], poseType: "backbend", energy: "warming",
        bodyRegion: "upper_body",
      },
      {
        pose: "Locust", duration: "30 sec", minutes: 0.5,
        chakras: ["heart", "solar"], bodyTargets: ["upper_back", "glutes"], poseType: "backbend", energy: "heating",
        bodyRegion: "upper_body",
        modifications: ["Lift one leg at a time", "Arms alongside body instead of clasped"],
      },
      {
        pose: "Bow", duration: "1 min", minutes: 1,
        chakras: ["heart", "solar"], bodyTargets: ["chest", "hip_flexors", "upper_back"], poseType: "backbend", energy: "heating",
        bodyRegion: "upper_body",
        prerequisites: ["upper_back", "hip_flexors"],
        modifications: ["One leg at a time", "Strap around ankles", "Locust as alternative"],
      },
      {
        pose: "Bridge", duration: "1 min", minutes: 1,
        chakras: ["heart", "sacral"], bodyTargets: ["hip_flexors", "glutes", "upper_back"], poseType: "backbend", energy: "warming",
        bodyRegion: "full_body",
        modifications: ["Block under sacrum for supported bridge", "Feet wider if lower back is tight"],
      },
      {
        pose: "Wheel", duration: "1 min", minutes: 1,
        chakras: ["heart"], bodyTargets: ["chest", "shoulders", "hip_flexors", "upper_back"], poseType: "backbend", energy: "heating",
        bodyRegion: "upper_body",
        prerequisites: ["hip_flexors", "upper_back", "shoulders"],
        modifications: ["Bridge as alternative", "Supported on two blocks under hands", "Focus on chest-opener — don't force full extension"],
      },
      {
        pose: "Constructive Rest", duration: "1 min", minutes: 1,
        chakras: ["root", "sacral"], bodyTargets: ["lower_back"], poseType: "supine", energy: "cooling",
        bodyRegion: "rest",
      },
      {
        pose: "Supta Baddhakonasana", duration: "2 min", minutes: 2,
        chakras: ["sacral", "heart"], bodyTargets: ["hip_rotators", "chest"], poseType: "supine", energy: "cooling",
        bodyRegion: "rest",
        modifications: ["Bolster under knees", "Rolled blanket under each thigh"],
      },
    ],
  },
  {
    category: "Wind-down",
    poses: [
      {
        pose: "Pigeon", duration: "2 min", minutes: 2,
        chakras: ["sacral"], bodyTargets: ["hip_rotators", "hip_flexors"], poseType: "hip_opener", energy: "cooling",
        bodyRegion: "lower_body",
        prerequisites: ["hip_rotators"],
        modifications: ["Reclined pigeon (supta kapotasana) — identical benefit, zero knee strain", "Blanket under front hip", "Figure 4 on the back"],
      },
      {
        pose: "Gomukhasana", duration: "2 min", minutes: 2,
        chakras: ["sacral", "heart"], bodyTargets: ["hip_rotators", "shoulders"], poseType: "seated", energy: "cooling",
        bodyRegion: "lower_body",
        modifications: ["Sit on a block", "Strap for the arm bind", "Keep bottom leg extended"],
      },
      {
        pose: "Janu Sirsasana", duration: "2 min", minutes: 2,
        chakras: ["root", "sacral"], bodyTargets: ["hamstrings", "hip_rotators"], poseType: "forward_fold", energy: "cooling",
        bodyRegion: "lower_body",
        modifications: ["Strap around foot", "Sit on a folded blanket"],
      },
      {
        pose: "Stargazer", duration: "1 min", minutes: 1,
        chakras: ["heart", "sacral"], bodyTargets: ["chest", "hip_rotators"], poseType: "supine", energy: "cooling",
        bodyRegion: "rest",
      },
      {
        pose: "Seated Forward Fold", duration: "2 min", minutes: 2,
        chakras: ["root"], bodyTargets: ["hamstrings", "lower_back"], poseType: "forward_fold", energy: "cooling",
        bodyRegion: "lower_body",
        modifications: ["Strap around feet", "Sit on a block or blanket", "Generous bend in knees"],
      },
      {
        pose: "Supine Twist", duration: "2 min", minutes: 2,
        chakras: ["solar"], bodyTargets: ["spine", "lower_back"], poseType: "twist", energy: "cooling",
        bodyRegion: "rest",
        modifications: ["Blanket between knees", "Keep both shoulders grounded — reduce the twist depth"],
      },
      {
        pose: "Happy Baby", duration: "1 min", minutes: 1,
        chakras: ["root", "sacral"], bodyTargets: ["hip_rotators", "lower_back"], poseType: "supine", energy: "cooling",
        bodyRegion: "rest",
        modifications: ["Strap around feet", "Hold one leg at a time"],
      },
      {
        pose: "Savasana", duration: "5 min", minutes: 5,
        chakras: ["crown"], bodyTargets: [], poseType: "supine", energy: "cooling",
        bodyRegion: "rest",
        modifications: ["Bolster under knees", "Eye pillow", "Blanket for warmth"],
      },
    ],
  },
];

// ─── Lookup map ──────────────────────────────────────────────────────────────

const _poseMap = new Map<string, PoseMeta>();
for (const cat of poseLibrary) {
  for (const pose of cat.poses) {
    _poseMap.set(pose.pose, pose);
  }
}

export function getPoseMeta(poseName: string): PoseMeta | undefined {
  return _poseMap.get(poseName);
}

// ─── Body region helpers ─────────────────────────────────────────────────────

const BODY_REGION_CLASSES: Record<BodyRegion, { gradient: string; dot: string; label: string }> = {
  lower_body: { gradient: "bg-gradient-to-r from-rose-100/80 to-white",    dot: "bg-rose-400",    label: "Lower body" },
  core:       { gradient: "bg-gradient-to-r from-amber-100/80 to-white",   dot: "bg-amber-400",   label: "Core" },
  upper_body: { gradient: "bg-gradient-to-r from-sky-100/80 to-white",     dot: "bg-sky-400",     label: "Upper body" },
  full_body:  { gradient: "bg-gradient-to-r from-emerald-100/80 to-white", dot: "bg-emerald-400", label: "Full body" },
  rest:       { gradient: "bg-gradient-to-r from-violet-100/80 to-white",  dot: "bg-violet-400",  label: "Rest" },
};

export function getBodyRegionClasses(region: BodyRegion) {
  return BODY_REGION_CLASSES[region];
}

export function getBodyRegionLabel(region: BodyRegion): string {
  return BODY_REGION_CLASSES[region].label;
}

// ─── Chakra helpers (kept for search/filter labels) ──────────────────────────

const CHAKRA_LABELS: Record<Chakra, string> = {
  root: "Root", sacral: "Sacral", solar: "Solar plexus",
  heart: "Heart", throat: "Throat", third_eye: "Third eye", crown: "Crown",
};

export function getChakraLabel(chakra: Chakra): string {
  return CHAKRA_LABELS[chakra];
}

// ─── Body target helpers ─────────────────────────────────────────────────────

const BODY_TARGET_LABELS: Record<BodyTarget, string> = {
  hip_flexors: "hip flexors", hip_rotators: "hip rotators", hamstrings: "hamstrings",
  quads: "quads", glutes: "glutes", core: "core", lower_back: "lower back",
  upper_back: "upper back", shoulders: "shoulders", chest: "chest",
  spine: "spine", ankles: "ankles", wrists: "wrists", arms: "arms", calves: "calves",
};

export function getBodyTargetLabel(target: BodyTarget): string {
  return BODY_TARGET_LABELS[target];
}
