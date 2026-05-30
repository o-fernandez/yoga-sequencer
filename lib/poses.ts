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
  sanskrit?: string;
  aliases?: string[];
  /** Curated families a pose belongs to (Surya A, Open Hips, …). Used as filter attributes. */
  groups?: string[];
  duration: string;
  minutes: number;
  chakras: Chakra[];
  bodyTargets: BodyTarget[];
  poseType: PoseType;
  energy: EnergyQuality;
  bodyRegion: BodyRegion;
  prerequisites?: BodyTarget[];
  modifications?: string[];
  defaultBreaths?: number;
  defaultHoldMode?: boolean;
};

export const poseLibrary: { category: string; poses: PoseMeta[] }[] = [
  {
    category: "Warm-up",
    poses: [
      {
        pose: "Centering Breath", sanskrit: "Pranayama", aliases: ["breath work", "breathwork", "pranayama", "centering"],
        duration: "2 min", minutes: 2,
        chakras: ["crown"], bodyTargets: [], poseType: "seated", energy: "grounding",
        bodyRegion: "rest",
        defaultBreaths: 5, defaultHoldMode: true,
      },
      {
        pose: "Cat/Cow", sanskrit: "Marjaryasana/Bitilasana", aliases: ["cat cow", "cat-cow", "marjaryasana", "bitilasana", "cat", "cow"],
        duration: "2 min", minutes: 2,
        chakras: ["sacral", "solar"], bodyTargets: ["spine", "lower_back"], poseType: "prone", energy: "warming",
        bodyRegion: "full_body",
        defaultBreaths: 5, defaultHoldMode: false,
      },
      {
        pose: "Child's Pose", sanskrit: "Balasana", aliases: ["childs pose", "child pose", "balasana", "bala"],
        duration: "1 min", minutes: 1,
        chakras: ["root", "third_eye"], bodyTargets: ["hip_rotators", "lower_back"], poseType: "prone", energy: "grounding",
        bodyRegion: "rest",
        defaultBreaths: 5, defaultHoldMode: true,
      },
      {
        pose: "Downward Dog", sanskrit: "Adho Mukha Svanasana", aliases: ["down dog", "downdog", "adho mukha", "adho mukha svanasana", "ado muka", "down facing dog"],
        duration: "1 min", minutes: 1,
        chakras: ["root", "third_eye"], bodyTargets: ["hamstrings", "calves", "shoulders", "upper_back"], poseType: "inversion", energy: "neutral",
        bodyRegion: "full_body",
        modifications: ["Bend knees generously to find length in the spine", "Pedal the heels alternately to warm the calves", "Puppy pose (forearms down) for tight shoulders"],
        defaultBreaths: 3, defaultHoldMode: false,
      },
      {
        pose: "Beast", aliases: ["beast pose", "hovering table", "table top hover"],
        duration: "1 min", minutes: 1,
        chakras: ["solar", "root"], bodyTargets: ["core", "wrists", "shoulders"], poseType: "prone", energy: "warming",
        bodyRegion: "core",
        modifications: ["Keep knees hovering just 1 inch off the floor", "Wrist discomfort: fists or forearm variation"],
        defaultBreaths: 3, defaultHoldMode: false,
      },
    ],
  },
  {
    category: "Surya A",
    poses: [
      {
        pose: "Mountain Pose", sanskrit: "Tadasana", aliases: ["mountain", "tada", "samasthiti", "tadasana"],
        duration: "30 sec", minutes: 0.5,
        chakras: ["root"], bodyTargets: [], poseType: "standing", energy: "grounding",
        bodyRegion: "full_body",
        defaultBreaths: 1, defaultHoldMode: false,
      },
      {
        pose: "Extended Mountain", sanskrit: "Urdhva Hastasana", aliases: ["upward salute", "raised hands", "arms overhead", "mountain arms up", "urdhva hastasana", "hands up", "ext mountain"],
        duration: "30 sec", minutes: 0.5,
        chakras: ["crown", "root"], bodyTargets: ["shoulders", "spine"], poseType: "standing", energy: "warming",
        bodyRegion: "full_body",
        modifications: ["Hands shoulder-width if shoulders are tight", "Soft micro-bend in the knees", "Gaze forward instead of up"],
        defaultBreaths: 1, defaultHoldMode: false,
      },
      {
        pose: "Standing Forward Fold", sanskrit: "Uttanasana", aliases: ["forward fold", "fwd fold", "forward bend", "uttanasana", "standing fold", "uttana"],
        duration: "30 sec", minutes: 0.5,
        chakras: ["root", "sacral"], bodyTargets: ["hamstrings", "lower_back"], poseType: "forward_fold", energy: "cooling",
        bodyRegion: "lower_body",
        modifications: ["Bend knees deeply", "Hands to blocks"],
        defaultBreaths: 1, defaultHoldMode: false,
      },
      {
        pose: "Half Lift", sanskrit: "Ardha Uttanasana", aliases: ["halfway lift", "half forward fold", "ardha uttanasana", "half way lift", "flat back"],
        duration: "30 sec", minutes: 0.5,
        chakras: ["root", "solar"], bodyTargets: ["hamstrings", "core"], poseType: "forward_fold", energy: "warming",
        bodyRegion: "lower_body",
        modifications: ["Hands to shins or blocks", "Flat-back focus over hamstring length"],
        defaultBreaths: 1, defaultHoldMode: false,
      },
      {
        pose: "Plank", sanskrit: "Phalakasana", aliases: ["plank pose", "phalakasana", "high plank"],
        duration: "30 sec", minutes: 0.5,
        chakras: ["solar"], bodyTargets: ["core", "shoulders", "wrists", "arms"], poseType: "prone", energy: "heating",
        bodyRegion: "core",
        modifications: ["Knees down", "Wrist discomfort: forearm plank"],
        defaultBreaths: 1, defaultHoldMode: false,
      },
      {
        pose: "Chaturanga", sanskrit: "Chaturanga Dandasana", aliases: ["four-limbed staff", "low push-up", "chataranga", "chaturanga dandasana", "low plank", "chat"],
        duration: "30 sec", minutes: 0.5,
        chakras: ["solar", "heart"], bodyTargets: ["core", "shoulders", "chest", "arms", "wrists"], poseType: "prone", energy: "heating",
        bodyRegion: "upper_body",
        modifications: ["Lower all the way to belly", "Knees-down chaturanga", "Use a block under the chest"],
        defaultBreaths: 1, defaultHoldMode: false,
      },
      {
        pose: "Upward Dog", sanskrit: "Urdhva Mukha Svanasana", aliases: ["updog", "up dog", "urdhva mukha", "urdhva mukha svanasana", "urdvha mukha", "upward facing dog"],
        duration: "30 sec", minutes: 0.5,
        chakras: ["heart"], bodyTargets: ["chest", "upper_back", "hip_flexors"], poseType: "backbend", energy: "heating",
        bodyRegion: "upper_body",
        modifications: ["Cobra (stay lower, thighs on floor)", "Roll over toes one foot at a time"],
        defaultBreaths: 1, defaultHoldMode: false,
      },
    ],
  },
  {
    category: "Surya B",
    poses: [
      {
        pose: "Chair", sanskrit: "Utkatasana", aliases: ["fierce pose", "awkward chair", "utkata", "utkatasana", "lightning bolt"],
        groups: ["Surya B", "Midline Close"],
        duration: "30 sec", minutes: 0.5,
        chakras: ["root", "solar"], bodyTargets: ["quads", "glutes", "core"], poseType: "standing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Less depth in the bend", "Arms to heart center if shoulders are tight"],
        defaultBreaths: 1, defaultHoldMode: false,
      },
      {
        pose: "Warrior I", sanskrit: "Virabhadrasana I", aliases: ["warrior 1", "warrior one", "vira 1", "vira I", "virabhadrasana 1", "virabhadrasana I"],
        duration: "1 min", minutes: 1,
        chakras: ["root", "solar"], bodyTargets: ["hip_flexors", "quads", "glutes", "upper_back"], poseType: "standing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Shorten stance for tight hips", "Back heel lifted (crescent variation)"],
        defaultBreaths: 1, defaultHoldMode: false,
      },
      {
        pose: "Vinyasa", aliases: ["flow", "vinyasa flow", "sun salutation flow"],
        duration: "30 sec", minutes: 0.5,
        chakras: ["solar", "heart"], bodyTargets: ["core", "shoulders", "chest"], poseType: "prone", energy: "heating",
        bodyRegion: "full_body",
        modifications: ["Skip to child's pose anytime", "Knees-down chaturanga"],
        defaultBreaths: 1, defaultHoldMode: false,
      },
    ],
  },
  {
    category: "Neutral Hips",
    poses: [
      {
        pose: "Low Lunge", sanskrit: "Anjaneyasana", aliases: ["anjaneyasana", "lunge", "low lunge", "kneeling lunge", "anjaneya"],
        duration: "1 min", minutes: 1,
        chakras: ["root", "sacral"], bodyTargets: ["hip_flexors", "quads"], poseType: "standing", energy: "warming",
        bodyRegion: "lower_body",
        modifications: ["Blanket under back knee", "Hands to blocks"],
      },
      {
        pose: "Crescent", sanskrit: "Ashta Chandrasana", aliases: ["crescent lunge", "high lunge", "ashta chandrasana", "crescent pose"],
        duration: "1 min", minutes: 1,
        chakras: ["solar", "sacral"], bodyTargets: ["hip_flexors", "quads", "core"], poseType: "standing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Hands to hips to reduce upper body demand", "Shorten stance"],
        defaultBreaths: 5, defaultHoldMode: false,
      },
      {
        pose: "Twisted Crescent", sanskrit: "Parivrtta Anjaneyasana", aliases: ["twisted lunge", "revolved crescent", "revolved lunge", "parivrtta anjaneyasana", "low lunge twist"],
        duration: "1 min", minutes: 1,
        chakras: ["solar"], bodyTargets: ["hip_flexors", "core", "upper_back"], poseType: "twist", energy: "heating",
        bodyRegion: "full_body",
        modifications: ["Prayer hands at heart instead of open twist", "Back knee down"],
      },
      {
        pose: "Warrior III", sanskrit: "Virabhadrasana III", aliases: ["warrior 3", "warrior three", "vira III", "vira 3", "virabhadrasana 3", "virabhadrasana III"],
        duration: "1 min", minutes: 1,
        chakras: ["root", "solar"], bodyTargets: ["hamstrings", "glutes", "core"], poseType: "balancing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Hands to hips", "Fingertips to blocks", "Stand near a wall for balance"],
        defaultBreaths: 5, defaultHoldMode: false,
      },
      {
        pose: "Eagle", sanskrit: "Garudasana", aliases: ["garuda", "eagle pose", "garudasana"],
        duration: "1 min", minutes: 1,
        chakras: ["third_eye", "sacral"], bodyTargets: ["hip_rotators", "shoulders", "upper_back"], poseType: "balancing", energy: "grounding",
        bodyRegion: "lower_body",
        modifications: ["Cross legs without wrapping (figure 4 shape)", "Eagle arms only (seated)"],
        defaultBreaths: 5, defaultHoldMode: false,
      },
      {
        pose: "Side Plank", sanskrit: "Vasisthasana", aliases: ["vasistha", "vasisthasana", "side plank pose"],
        duration: "30 sec", minutes: 0.5,
        chakras: ["solar"], bodyTargets: ["core", "shoulders", "wrists"], poseType: "arm_balance", energy: "heating",
        bodyRegion: "core",
        modifications: ["Bottom knee down", "Forearm side plank"],
      },
      {
        pose: "Figure 4 Balance", sanskrit: "Eka Pada Utkatasana", aliases: ["figure four", "figure-4", "standing figure 4", "eka pada utkatasana", "one-legged chair"],
        duration: "1 min", minutes: 1,
        chakras: ["root", "sacral"], bodyTargets: ["hip_rotators", "glutes"], poseType: "balancing", energy: "grounding",
        bodyRegion: "lower_body",
        modifications: ["Hand to wall for balance", "Seated figure 4 instead"],
      },
      {
        pose: "Dancing Shiva", sanskrit: "Natarajasana", aliases: ["nataraja", "lord of the dance", "natarajasana", "dancer pose", "dancer"],
        duration: "1 min", minutes: 1,
        chakras: ["root"], bodyTargets: ["hip_flexors", "quads"], poseType: "balancing", energy: "grounding",
        bodyRegion: "lower_body",
        modifications: ["Fingertips to wall", "Reduce the knee lift"],
      },
      {
        pose: "Standing Splits", sanskrit: "Urdhva Prasarita Eka Padasana", aliases: ["standing split", "urdhva prasarita eka padasana", "standing straddle split"],
        duration: "1 min", minutes: 1,
        chakras: ["root", "sacral"], bodyTargets: ["hamstrings", "hip_flexors"], poseType: "forward_fold", energy: "neutral",
        bodyRegion: "lower_body",
        modifications: ["Hands to blocks", "Keep lifted leg low — focus on hip alignment"],
      },
      {
        pose: "Skandasana", sanskrit: "Skandasana", aliases: ["side lunge", "lateral lunge", "skanda", "side squat"],
        duration: "1 min", minutes: 1,
        chakras: ["root", "sacral"], bodyTargets: ["hip_rotators", "hamstrings", "quads"], poseType: "standing", energy: "cooling",
        bodyRegion: "lower_body",
        modifications: ["Stay higher if ankles are tight", "Hands to blocks", "Heel elevated on a blanket"],
      },
      {
        pose: "Tree", sanskrit: "Vrksasana", aliases: ["tree pose", "vriksasana", "vrksasana", "balancing tree"],
        duration: "1 min", minutes: 1,
        chakras: ["root", "heart"], bodyTargets: ["hip_rotators", "ankles", "core"], poseType: "balancing", energy: "grounding",
        bodyRegion: "lower_body",
        modifications: ["Toes to the floor, heel to the ankle (kickstand)", "Foot to the calf instead of the inner thigh", "Hand to a wall"],
        defaultBreaths: 5, defaultHoldMode: false,
      },
      {
        pose: "Standing Hand-to-Big-Toe", sanskrit: "Utthita Hasta Padangusthasana", aliases: ["hand to big toe", "extended hand to toe", "standing big toe pose", "utthita hasta padangusthasana", "uhp"],
        duration: "1 min", minutes: 1,
        chakras: ["root", "solar"], bodyTargets: ["hamstrings", "hip_flexors", "core"], poseType: "balancing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Strap around the foot", "Bend the lifted knee", "Hand to a wall for balance"],
      },
    ],
  },
  {
    category: "Open Hips",
    poses: [
      {
        pose: "Devotional Warrior", sanskrit: "Baddha Virabhadrasana", aliases: ["humble warrior", "baddha vira", "baddha virabhadrasana", "humble", "bound warrior"],
        duration: "1 min", minutes: 1,
        chakras: ["sacral", "heart"], bodyTargets: ["hip_rotators", "chest"], poseType: "standing", energy: "warming",
        bodyRegion: "lower_body",
        defaultBreaths: 5, defaultHoldMode: false,
      },
      {
        pose: "Warrior II", sanskrit: "Virabhadrasana II", aliases: ["warrior 2", "warrior two", "vira II", "vira 2", "virabhadrasana 2", "virabhadrasana II"],
        duration: "1 min", minutes: 1,
        chakras: ["sacral"], bodyTargets: ["hip_rotators", "quads"], poseType: "standing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Shorten stance", "Reduce depth of front knee bend"],
        defaultBreaths: 5, defaultHoldMode: false,
      },
      {
        pose: "Peaceful Warrior", sanskrit: "Shanti Virabhadrasana", aliases: ["reverse warrior", "peace warrior", "shanti vira", "reversed warrior"],
        duration: "45 sec", minutes: 0.75,
        chakras: ["sacral", "heart"], bodyTargets: ["hip_rotators", "chest"], poseType: "standing", energy: "warming",
        bodyRegion: "lower_body",
        defaultBreaths: 3, defaultHoldMode: false,
      },
      {
        pose: "Triangle", sanskrit: "Utthita Trikonasana", aliases: ["trikonasana", "trikona", "extended triangle", "utthita trikonasana", "tri"],
        duration: "1 min", minutes: 1,
        chakras: ["sacral", "heart"], bodyTargets: ["hamstrings", "hip_rotators", "chest"], poseType: "standing", energy: "neutral",
        bodyRegion: "lower_body",
        modifications: ["Block under bottom hand", "Bend front knee slightly"],
        defaultBreaths: 5, defaultHoldMode: false,
      },
      {
        pose: "Extended Side Angle", sanskrit: "Utthita Parsvakonasana", aliases: ["side angle", "parsvakonasana", "utthita parsvakonasana", "ext side angle"],
        duration: "1 min", minutes: 1,
        chakras: ["sacral", "solar"], bodyTargets: ["hip_rotators", "core"], poseType: "standing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Forearm to thigh instead of hand to floor", "Block under bottom hand"],
        defaultBreaths: 5, defaultHoldMode: false,
      },
      {
        pose: "Half Moon", sanskrit: "Ardha Chandrasana", aliases: ["ardha chandra", "ardha chandrasana", "half moon pose"],
        duration: "1 min", minutes: 1,
        chakras: ["sacral", "third_eye"], bodyTargets: ["hip_rotators", "hamstrings"], poseType: "balancing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Block under bottom hand", "Stand near a wall", "Keep top hand on hip"],
        defaultBreaths: 5, defaultHoldMode: false,
      },
      {
        pose: "Revolved Triangle", sanskrit: "Parivrtta Trikonasana", aliases: ["revolved triangle", "twisted triangle", "parivrtta trikonasana", "parivrtta trikona"],
        duration: "1 min", minutes: 1,
        chakras: ["solar", "sacral"], bodyTargets: ["hamstrings", "hip_rotators", "upper_back"], poseType: "twist", energy: "neutral",
        bodyRegion: "full_body",
        modifications: ["Block under bottom hand", "Shorten stance", "Bent front knee"],
      },
      {
        pose: "Prasarita", sanskrit: "Prasarita Padottanasana", aliases: ["wide-legged forward fold", "prasarita padottanasana", "wide leg fold", "prasarita fold"],
        duration: "1 min", minutes: 1,
        chakras: ["root", "sacral"], bodyTargets: ["hamstrings", "hip_rotators"], poseType: "forward_fold", energy: "cooling",
        bodyRegion: "lower_body",
        modifications: ["Hands to blocks", "Slight knee bend"],
      },
      {
        pose: "Lizard", sanskrit: "Utthan Pristhasana", aliases: ["lizard pose", "gecko", "utthan pristhasana", "high lizard", "deep lunge"],
        duration: "1 min", minutes: 1,
        chakras: ["sacral"], bodyTargets: ["hip_flexors", "hip_rotators"], poseType: "hip_opener", energy: "warming",
        bodyRegion: "lower_body",
        modifications: ["Back knee down", "Forearms to mat or block", "Blanket under back knee"],
      },
      {
        pose: "Pyramid", sanskrit: "Parsvottanasana", aliases: ["pyramid pose", "intense side stretch", "parsvottanasana", "standing forward fold split stance"],
        duration: "1 min", minutes: 1,
        chakras: ["root", "sacral"], bodyTargets: ["hamstrings", "hip_flexors"], poseType: "forward_fold", energy: "cooling",
        bodyRegion: "lower_body",
        modifications: ["Blocks under hands", "Micro-bend in front knee"],
      },
      {
        pose: "Goddess", sanskrit: "Utkata Konasana", aliases: ["goddess pose", "horse stance", "temple pose", "utkata konasana", "goddess squat"],
        duration: "1 min", minutes: 1,
        chakras: ["sacral", "root"], bodyTargets: ["quads", "hip_rotators", "glutes"], poseType: "standing", energy: "heating",
        bodyRegion: "lower_body",
        modifications: ["Less depth in the squat", "Heels in if the ankles complain", "Hands to heart center"],
      },
    ],
  },
  {
    category: "Midline Close",
    poses: [
      {
        pose: "Revolved Chair", sanskrit: "Parivrtta Utkatasana", aliases: ["twisted chair", "prayer twist", "parivrtta utkatasana", "chair twist"],
        duration: "30 sec", minutes: 0.5,
        chakras: ["solar"], bodyTargets: ["core", "upper_back", "quads"], poseType: "twist", energy: "heating",
        bodyRegion: "full_body",
        modifications: ["Prayer hands only (no open twist)", "Reduce chair depth"],
      },
      {
        pose: "Malasana", sanskrit: "Malasana", aliases: ["garland pose", "yoga squat", "squat", "deep squat", "mala"],
        duration: "1 min", minutes: 1,
        chakras: ["sacral", "root"], bodyTargets: ["hip_rotators", "ankles"], poseType: "standing", energy: "grounding",
        bodyRegion: "lower_body",
        modifications: ["Heels on a rolled blanket", "Sit on a block"],
      },
      {
        pose: "Crow", sanskrit: "Bakasana", aliases: ["crane pose", "bakasana", "crow pose", "kakasana", "baka"],
        duration: "1 min", minutes: 1,
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
        pose: "Forearm Plank", sanskrit: "Makara Adho Mukha Svanasana", aliases: ["dolphin plank", "elbow plank", "makara adho mukha"],
        duration: "30 sec", minutes: 0.5,
        chakras: ["solar"], bodyTargets: ["core", "shoulders"], poseType: "prone", energy: "heating",
        bodyRegion: "core",
        modifications: ["Knees down", "Reduce to 15 seconds"],
      },
      {
        pose: "Boat", sanskrit: "Navasana", aliases: ["boat pose", "navasana", "full boat", "paripurna navasana", "nava"],
        duration: "30 sec", minutes: 0.5,
        chakras: ["solar"], bodyTargets: ["core", "hip_flexors"], poseType: "seated", energy: "heating",
        bodyRegion: "core",
        modifications: ["Hold behind the thighs", "Keep the knees bent (half boat)", "Heels to the floor — lift just the chest"],
      },
      {
        pose: "Dolphin", sanskrit: "Ardha Pincha Mayurasana", aliases: ["dolphin pose", "forearm down dog", "ardha pincha mayurasana", "pincha prep"],
        duration: "1 min", minutes: 1,
        chakras: ["solar", "third_eye"], bodyTargets: ["shoulders", "core", "hamstrings", "upper_back"], poseType: "inversion", energy: "warming",
        bodyRegion: "full_body",
        modifications: ["Bend the knees generously", "Walk the feet wider", "Forearms parallel — block between the hands"],
      },
      {
        pose: "Cobra", sanskrit: "Bhujangasana", aliases: ["cobra pose", "baby cobra", "bhujanga", "bhujangasana"],
        duration: "30 sec", minutes: 0.5,
        chakras: ["heart"], bodyTargets: ["chest", "upper_back"], poseType: "backbend", energy: "warming",
        bodyRegion: "upper_body",
        modifications: ["Stay low (baby cobra)", "Hands wider for less depth", "Press the tops of the feet down to protect the low back"],
      },
      {
        pose: "Camel", sanskrit: "Ustrasana", aliases: ["camel pose", "ustrasana", "ustra"],
        duration: "1 min", minutes: 1,
        chakras: ["heart", "throat"], bodyTargets: ["chest", "hip_flexors", "upper_back", "shoulders"], poseType: "backbend", energy: "heating",
        bodyRegion: "upper_body",
        prerequisites: ["hip_flexors", "upper_back"],
        modifications: ["Hands to the lower back (skip the reach to the heels)", "Toes tucked to raise the heels", "Block between the thighs"],
      },
      {
        pose: "Fish", sanskrit: "Matsyasana", aliases: ["fish pose", "matsyasana", "matsya"],
        duration: "1 min", minutes: 1,
        chakras: ["heart", "throat"], bodyTargets: ["chest", "upper_back", "shoulders"], poseType: "backbend", energy: "warming",
        bodyRegion: "upper_body",
        modifications: ["Block under the upper back and head", "Knees bent, feet on the floor", "Forearms pressing for support"],
      },
      {
        pose: "Sphinx", sanskrit: "Salamba Bhujangasana", aliases: ["sphinx pose", "salamba bhujangasana", "supported cobra"],
        duration: "1 min", minutes: 1,
        chakras: ["heart"], bodyTargets: ["chest", "upper_back"], poseType: "backbend", energy: "warming",
        bodyRegion: "upper_body",
      },
      {
        pose: "Locust", sanskrit: "Salabhasana", aliases: ["locust pose", "salabhasana", "shalabhasana", "grasshopper"],
        duration: "30 sec", minutes: 0.5,
        chakras: ["heart", "solar"], bodyTargets: ["upper_back", "glutes"], poseType: "backbend", energy: "heating",
        bodyRegion: "upper_body",
        modifications: ["Lift one leg at a time", "Arms alongside body instead of clasped"],
      },
      {
        pose: "Bow", sanskrit: "Dhanurasana", aliases: ["bow pose", "dhanura", "dhanurasana"],
        duration: "1 min", minutes: 1,
        chakras: ["heart", "solar"], bodyTargets: ["chest", "hip_flexors", "upper_back"], poseType: "backbend", energy: "heating",
        bodyRegion: "upper_body",
        prerequisites: ["upper_back", "hip_flexors"],
        modifications: ["One leg at a time", "Strap around ankles", "Locust as alternative"],
      },
      {
        pose: "Bridge", sanskrit: "Setu Bandha Sarvangasana", aliases: ["bridge pose", "setu bandha", "setu bandha sarvangasana"],
        duration: "1 min", minutes: 1,
        chakras: ["heart", "sacral"], bodyTargets: ["hip_flexors", "glutes", "upper_back"], poseType: "backbend", energy: "warming",
        bodyRegion: "full_body",
        modifications: ["Block under sacrum for supported bridge", "Feet wider if lower back is tight"],
      },
      {
        pose: "Wheel", sanskrit: "Urdhva Dhanurasana", aliases: ["full wheel", "upward bow", "chakrasana", "urdhva dhanurasana", "urdhva dhanur", "full backbend", "back bend"],
        duration: "1 min", minutes: 1,
        chakras: ["heart"], bodyTargets: ["chest", "shoulders", "hip_flexors", "upper_back"], poseType: "backbend", energy: "heating",
        bodyRegion: "upper_body",
        prerequisites: ["hip_flexors", "upper_back", "shoulders"],
        modifications: ["Bridge as alternative", "Supported on two blocks under hands", "Focus on chest-opener — don't force full extension"],
      },
      {
        pose: "Constructive Rest", aliases: ["rest", "savasana variation", "lying rest"],
        duration: "1 min", minutes: 1,
        chakras: ["root", "sacral"], bodyTargets: ["lower_back"], poseType: "supine", energy: "cooling",
        bodyRegion: "rest",
      },
      {
        pose: "Supta Baddhakonasana", sanskrit: "Supta Baddha Konasana", aliases: ["reclined bound angle", "supta baddha", "goddess supine", "reclined butterfly"],
        duration: "2 min", minutes: 2,
        chakras: ["sacral", "heart"], bodyTargets: ["hip_rotators", "chest"], poseType: "supine", energy: "cooling",
        bodyRegion: "rest",
        modifications: ["Bolster under knees", "Rolled blanket under each thigh"],
        defaultBreaths: 10, defaultHoldMode: true,
      },
    ],
  },
  {
    category: "Wind-down",
    poses: [
      {
        pose: "Pigeon", sanskrit: "Eka Pada Rajakapotasana", aliases: ["pigeon pose", "eka pada kapotasana", "kapotasana", "sleeping pigeon", "eka pada rajakapotasana"],
        duration: "2 min", minutes: 2,
        chakras: ["sacral"], bodyTargets: ["hip_rotators", "hip_flexors"], poseType: "hip_opener", energy: "cooling",
        bodyRegion: "lower_body",
        prerequisites: ["hip_rotators"],
        modifications: ["Reclined pigeon (supta kapotasana) — identical benefit, zero knee strain", "Blanket under front hip", "Figure 4 on the back"],
        defaultBreaths: 8, defaultHoldMode: true,
      },
      {
        pose: "Gomukhasana", sanskrit: "Gomukhasana", aliases: ["cow face pose", "cow face", "gomukha", "go mukha"],
        duration: "2 min", minutes: 2,
        chakras: ["sacral", "heart"], bodyTargets: ["hip_rotators", "shoulders"], poseType: "seated", energy: "cooling",
        bodyRegion: "lower_body",
        modifications: ["Sit on a block", "Strap for the arm bind", "Keep bottom leg extended"],
        defaultBreaths: 8, defaultHoldMode: true,
      },
      {
        pose: "Janu Sirsasana", sanskrit: "Janu Sirsasana", aliases: ["head to knee pose", "seated forward fold one leg", "janu sirsa", "janu"],
        duration: "2 min", minutes: 2,
        chakras: ["root", "sacral"], bodyTargets: ["hamstrings", "hip_rotators"], poseType: "forward_fold", energy: "cooling",
        bodyRegion: "lower_body",
        modifications: ["Strap around foot", "Sit on a folded blanket"],
        defaultBreaths: 8, defaultHoldMode: true,
      },
      {
        pose: "Stargazer", aliases: ["stargazer pose", "star gazer"],
        duration: "1 min", minutes: 1,
        chakras: ["heart", "sacral"], bodyTargets: ["chest", "hip_rotators"], poseType: "supine", energy: "cooling",
        bodyRegion: "rest",
      },
      {
        pose: "Seated Forward Fold", sanskrit: "Paschimottanasana", aliases: ["seated forward bend", "paschimo", "paschimottana", "paschimottanasana"],
        duration: "2 min", minutes: 2,
        chakras: ["root"], bodyTargets: ["hamstrings", "lower_back"], poseType: "forward_fold", energy: "cooling",
        bodyRegion: "lower_body",
        modifications: ["Strap around feet", "Sit on a block or blanket", "Generous bend in knees"],
        defaultBreaths: 8, defaultHoldMode: true,
      },
      {
        pose: "Supine Twist", sanskrit: "Supta Matsyendrasana", aliases: ["spinal twist", "reclining twist", "lying twist", "supta matsyendrasana", "jathara parivartanasana"],
        duration: "2 min", minutes: 2,
        chakras: ["solar"], bodyTargets: ["spine", "lower_back"], poseType: "twist", energy: "cooling",
        bodyRegion: "rest",
        modifications: ["Blanket between knees", "Keep both shoulders grounded — reduce the twist depth"],
        defaultBreaths: 10, defaultHoldMode: true,
      },
      {
        pose: "Happy Baby", sanskrit: "Ananda Balasana", aliases: ["happy baby pose", "ananda bala", "ananda balasana", "dead bug"],
        duration: "1 min", minutes: 1,
        chakras: ["root", "sacral"], bodyTargets: ["hip_rotators", "lower_back"], poseType: "supine", energy: "cooling",
        bodyRegion: "rest",
        modifications: ["Strap around feet", "Hold one leg at a time"],
        defaultBreaths: 10, defaultHoldMode: true,
      },
      {
        pose: "Seated Twist", sanskrit: "Ardha Matsyendrasana", aliases: ["seated twist", "half lord of the fishes", "seated spinal twist", "ardha matsyendrasana", "matsyendrasana"],
        duration: "1 min", minutes: 1,
        chakras: ["solar", "sacral"], bodyTargets: ["spine", "hip_rotators", "upper_back"], poseType: "twist", energy: "cooling",
        bodyRegion: "full_body",
        modifications: ["Keep the bottom leg extended", "Hug the knee instead of binding", "Sit on a folded blanket"],
      },
      {
        pose: "Bound Angle", sanskrit: "Baddha Konasana", aliases: ["cobbler pose", "butterfly", "seated butterfly", "baddha konasana", "bound angle pose"],
        duration: "2 min", minutes: 2,
        chakras: ["sacral", "root"], bodyTargets: ["hip_rotators", "hip_flexors"], poseType: "seated", energy: "cooling",
        bodyRegion: "lower_body",
        modifications: ["Sit on a blanket", "Blocks under the knees", "Hands behind for support, chest tall"],
      },
      {
        pose: "Wide-Angle Seated Fold", sanskrit: "Upavistha Konasana", aliases: ["wide angle seated forward fold", "seated straddle", "straddle fold", "upavistha konasana", "wide leg seated fold"],
        duration: "2 min", minutes: 2,
        chakras: ["root", "sacral"], bodyTargets: ["hamstrings", "hip_rotators"], poseType: "forward_fold", energy: "cooling",
        bodyRegion: "lower_body",
        modifications: ["Sit on a blanket", "Micro-bend the knees", "Walk the hands forward only as far as the spine stays long"],
      },
      {
        pose: "Thread the Needle", sanskrit: "Parsva Balasana", aliases: ["thread the needle", "parsva balasana", "supine shoulder twist", "needle"],
        duration: "1 min", minutes: 1,
        chakras: ["heart", "throat"], bodyTargets: ["upper_back", "shoulders", "spine"], poseType: "twist", energy: "cooling",
        bodyRegion: "upper_body",
        modifications: ["Stay higher on the supporting hand", "Bolster under the shoulder", "Reach the top arm overhead instead of threading"],
      },
      {
        pose: "Legs Up the Wall", sanskrit: "Viparita Karani", aliases: ["legs up the wall", "viparita karani", "legs up wall", "restorative inversion"],
        duration: "3 min", minutes: 3,
        chakras: ["root", "crown"], bodyTargets: ["lower_back"], poseType: "inversion", energy: "cooling",
        bodyRegion: "rest",
        modifications: ["Bolster under the hips", "Away from the wall with knees bent", "Strap around the thighs"],
        defaultBreaths: 10, defaultHoldMode: true,
      },
      {
        pose: "Savasana", sanskrit: "Savasana", aliases: ["corpse pose", "final relaxation", "sava", "shavasana", "final rest"],
        duration: "5 min", minutes: 5,
        chakras: ["crown"], bodyTargets: [], poseType: "supine", energy: "cooling",
        bodyRegion: "rest",
        modifications: ["Bolster under knees", "Eye pillow", "Blanket for warmth"],
        defaultBreaths: 15, defaultHoldMode: true,
      },
    ],
  },
];

// ─── Lookup map ──────────────────────────────────────────────────────────────

/** Every curated family, in library order — used to build the group filter chips. */
export const ALL_GROUPS: string[] = poseLibrary.map((cat) => cat.category);

/** Flat list of every pose, each tagged with the family it came from. */
export const allPoses: PoseMeta[] = [];

const _poseMap = new Map<string, PoseMeta>();
for (const cat of poseLibrary) {
  for (const pose of cat.poses) {
    if (!pose.groups) pose.groups = [cat.category];
    _poseMap.set(pose.pose, pose);
    allPoses.push(pose);
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
