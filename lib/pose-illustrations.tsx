// lib/pose-illustrations.tsx
// Filled SVG silhouette illustrations for yoga poses.
// ViewBox: 0 0 36 44 — fill="currentColor" throughout.
// Lookup via getPoseIllustration(poseName, className?).

import React from "react";

type SvgFn = (cls: string) => React.ReactElement;

function wrap(cls: string, children: React.ReactNode): React.ReactElement {
  return (
    <svg viewBox="0 0 36 44" fill="currentColor" className={cls} aria-hidden>
      {children}
    </svg>
  );
}

// ─── Pose silhouettes ────────────────────────────────────────────────────────

// Default: seated cross-legged (Lotus / Sukhasana)
const seated: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="18" cy="5" r="3.5" />
    {/* body + wide crossed-leg mound */}
    <path d="M14,9 Q8,18 4,23 Q2,30 6,36 Q10,41 18,42 Q26,41 30,36 Q34,30 32,23 Q28,18 22,9 Z" />
  </>);

// Tree — tall standing body, bent knee out to side, arms raised overhead
const tree: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="18" cy="4" r="3.5" />
    {/* left arm up */}
    <path d="M16,10 L8,2 L10,0 L18,9 Z" />
    {/* right arm up */}
    <path d="M20,10 L28,2 L26,0 L18,9 Z" />
    {/* body + standing leg */}
    <rect x="15" y="8" width="6" height="34" rx="3" />
    {/* bent knee going to the right */}
    <path d="M17,27 Q10,25 8,32 Q7,38 12,40 Q15,41 17,37 Q18,32 18,28 Z" />
  </>);

// Eagle — compact, wrapped arms as wide horizontal band, oval lower body
const eagle: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="18" cy="4" r="3.5" />
    {/* wrapped arms band */}
    <path d="M6,8 Q6,6 10,6 L26,6 Q30,6 30,8 Q30,13 26,14 L10,14 Q6,13 6,8 Z" />
    {/* narrow torso */}
    <rect x="15.5" y="14" width="5" height="6" rx="2" />
    {/* crossed/wound lower body */}
    <path d="M12,20 Q10,26 11,33 Q12,39 18,40 Q24,39 25,33 Q26,26 24,20 Z" />
  </>);

// Warrior I — lunge, arms raised, front knee bent, back leg extended
const warriorI: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="18" cy="4" r="3.5" />
    {/* arms raised */}
    <path d="M16,10 L10,3 L12,1 L18,9 Z" />
    <path d="M20,10 L26,3 L24,1 L18,9 Z" />
    {/* torso */}
    <rect x="15" y="8" width="6" height="13" rx="2.5" />
    {/* front leg — bent, going straight down */}
    <path d="M16,21 L16,34 L16,44 L20,44 L20,34 L20,21 Z" />
    {/* back leg — extended behind, going lower-left */}
    <path d="M15,21 L5,44 L10,44 L19,22 Z" />
  </>);

// Warrior II — arms spread wide, wide stance, head looking along front arm
const warriorII: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="29" cy="6" r="3.5" />
    {/* left arm (back) */}
    <rect x="1" y="17" width="15" height="5" rx="2.5" />
    {/* right arm (front) */}
    <rect x="22" y="17" width="14" height="5" rx="2.5" />
    {/* torso */}
    <rect x="15" y="9" width="7" height="14" rx="2.5" />
    {/* front leg (right) — deep bend */}
    <path d="M22,23 L28,37 L28,44 L23,44 L23,38 L18,24 Z" />
    {/* back leg (left) — extended */}
    <path d="M15,23 L5,44 L10,44 L18,24 Z" />
  </>);

// Warrior III — horizontal T: body + back leg horizontal, one leg vertical down
const warriorIII: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="5" cy="21" r="3.5" />
    {/* full horizontal bar: arms + body + back leg */}
    <rect x="0.5" y="18.5" width="35" height="5" rx="2.5" />
    {/* standing leg down */}
    <rect x="23.5" y="23.5" width="5.5" height="18" rx="2.75" />
  </>);

// Chair — arms overhead, deep knee bend, body slightly forward
const chair: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="18" cy="4" r="3.5" />
    {/* arms raised */}
    <path d="M16,10 L10,3 L12,1 L18,9 Z" />
    <path d="M20,10 L26,3 L24,1 L18,9 Z" />
    {/* torso leaning forward */}
    <path d="M14,8 L12,20 L24,20 L22,8 Z" />
    {/* thighs angled down */}
    <path d="M12,20 L6,33 L11,34 L17,21 Z" />
    <path d="M24,20 L30,33 L25,34 L19,21 Z" />
    {/* shins */}
    <rect x="5.5" y="32" width="5.5" height="11" rx="2.5" />
    <rect x="25" y="32" width="5.5" height="11" rx="2.5" />
  </>);

// Half Moon — body sideways, one arm up, one down, one leg up to the side
const halfMoon: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="28" cy="5" r="3.5" />
    {/* top arm pointing up */}
    <rect x="25.5" y="1" width="5" height="14" rx="2" />
    {/* body horizontal */}
    <rect x="13" y="18" width="15" height="5" rx="2" />
    {/* extended leg to the left */}
    <rect x="0.5" y="18" width="13" height="5" rx="2" />
    {/* standing leg down */}
    <rect x="24" y="23" width="5.5" height="19" rx="2.75" />
    {/* bottom arm reaching down */}
    <rect x="11.5" y="23" width="4.5" height="13" rx="2" />
  </>);

// Triangle — wide stance, lateral bend, one arm up, one reaching down
const triangle: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="28" cy="5" r="3.5" />
    {/* top arm up */}
    <rect x="25.5" y="1" width="5" height="14" rx="2" />
    {/* body leaning to the left (diagonal) */}
    <path d="M24,14 L10,31 L14,33 L28,16 Z" />
    {/* bottom arm reaching down-left */}
    <path d="M8,33 L3,43 L7,44 L12,34 Z" />
    {/* right leg (under head, vertical) */}
    <rect x="24" y="15" width="5.5" height="28" rx="2.5" />
    {/* left leg (extending to lower-left) */}
    <path d="M7,43 L5,37 Q5,32 9,30 L13,30 Q10,34 10,39 L10,43 Z" />
  </>);

// Extended Side Angle — similar to triangle but body lower, forearm to thigh
const extendedSideAngle: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="28" cy="7" r="3.5" />
    {/* top arm reaching overhead along ear */}
    <path d="M26,11 L18,1 L20,0 L28,10 Z" />
    {/* body diagonal */}
    <path d="M24,16 L7,33 L11,36 L28,19 Z" />
    {/* bottom arm to floor */}
    <rect x="4" y="33" width="7" height="4.5" rx="2" />
    {/* front leg (right, deep bend) */}
    <path d="M23,18 L28,36 L28,44 L23,44 L23,37 L18,20 Z" />
    {/* back leg (left, extended) */}
    <path d="M10,34 L4,44 L9,44 L15,35 Z" />
  </>);

// Crow — arm balance, body hovering, arms bent supporting weight
const crow: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="17" cy="7" r="3.5" />
    {/* body (compact oval, elevated) */}
    <path d="M10,14 Q10,9 17,9 Q25,9 25,16 Q25,24 17,25 Q9,24 10,14 Z" />
    {/* left arm bent to floor */}
    <path d="M10,20 Q8,28 7,36 L11,37 Q13,29 14,22 Z" />
    {/* right arm bent to floor */}
    <path d="M25,20 Q27,28 28,36 L24,37 Q23,29 22,22 Z" />
  </>);

// Wheel — full backbend arch (evenodd hollow arch + hand/foot dots)
const wheel: SvgFn = (cls) =>
  wrap(cls, <>
    <path fillRule="evenodd"
      d="M3,44 Q0,14 18,4 Q36,14 33,44 Z M9,44 Q8,21 18,13 Q28,21 27,44 Z" />
    <circle cx="5" cy="42" r="3" />
    <circle cx="31" cy="42" r="3" />
  </>);

// Camel — kneeling, arch backward, hands reaching heels
const camel: SvgFn = (cls) =>
  wrap(cls, <>
    {/* kneeling shins */}
    <rect x="7" y="28" width="7" height="14" rx="3" />
    <rect x="22" y="28" width="7" height="14" rx="3" />
    {/* arch body */}
    <path fillRule="evenodd"
      d="M10,30 Q7,10 18,6 Q29,10 26,30 Z M14,30 Q13,16 18,13 Q23,16 22,30 Z" />
    {/* head (hanging back, inside arch hollow — re-filled by evenodd) */}
    <path fillRule="evenodd"
      d="M10,30 Q7,10 18,6 Q29,10 26,30 Z M14,30 Q13,16 18,13 Q23,16 22,30 Z M20.5,10 a2.5,2.5 0 1,0 -5,0 a2.5,2.5 0 1,0 5,0 Z" />
  </>);

// Bridge — lying arch, profile view (feet left, shoulders right)
const bridge: SvgFn = (cls) =>
  wrap(cls, <>
    {/* arch body silhouette (profile) */}
    <path d="M2,42 L2,38 Q5,18 14,11 Q22,5 30,14 L32,22 L32,38 Q28,34 22,30 Q18,27 14,28 Q8,31 6,38 L6,42 Z" />
    {/* head (right side, on floor) */}
    <circle cx="33" cy="37" r="3" />
    {/* foot (left side, on floor) */}
    <ellipse cx="3" cy="43" rx="4" ry="2" />
  </>);

// Pigeon — front leg bent flat, back leg extended, body upright
const pigeon: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="17" cy="5" r="3.5" />
    {/* torso */}
    <rect x="14" y="9" width="6" height="14" rx="3" />
    {/* front bent leg (going left, low to ground) */}
    <path d="M18,24 Q14,22 10,24 Q4,27 4,33 Q4,38 8,40 Q12,41 15,37 Q17,34 17,29 Z" />
    {/* back leg extended right */}
    <path d="M18,22 L34,26 L34,22 L18,20 Z" />
  </>);

// Bow — prone backbend, body arched, legs bent up behind
const bow: SvgFn = (cls) =>
  wrap(cls, <>
    {/* arched body silhouette */}
    <path fillRule="evenodd"
      d="M4,38 Q2,24 18,14 Q34,24 32,38 Z M9,38 Q9,26 18,20 Q27,26 27,38 Z" />
    {/* head */}
    <circle cx="18" cy="13" r="3.5" />
    {/* ankle area / foot tips (bottom) */}
    <ellipse cx="18" cy="38" rx="10" ry="3" />
  </>);

// Dancer (Dancing Shiva / Natarajasana) — balance, lifted leg behind, arm forward
const dancer: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="16" cy="4" r="3.5" />
    {/* forward arm */}
    <path d="M20,11 L32,5 L33,7 L21,13 Z" />
    {/* torso */}
    <rect x="13" y="8" width="6" height="14" rx="3" />
    {/* standing leg */}
    <rect x="13" y="21" width="6" height="22" rx="3" />
    {/* lifted leg arcing behind and up */}
    <path d="M19,24 Q26,22 31,16 Q35,10 31,6 Q29,4 27,6 Q29,9 27,14 Q24,18 19,21 Z" />
  </>);

// Figure 4 Balance — standing on one leg, other ankle crossed over knee
const figure4: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="18" cy="4" r="3.5" />
    {/* torso */}
    <rect x="15" y="8" width="6" height="13" rx="2.5" />
    {/* standing leg (goes to floor) */}
    <rect x="15" y="20" width="6" height="22" rx="3" />
    {/* crossed leg (figure-4 shape) — thigh goes horizontally, calf hangs down */}
    <path d="M17,26 Q22,23 26,26 Q29,30 26,34 Q23,37 20,34 Q18,31 17,27 Z" />
    {/* hanging calf of crossed leg */}
    <path d="M24,31 Q28,33 28,38 L24,38 Q24,35 22,33 Z" />
  </>);

// Skandasana — deep lateral lunge, one leg extended, other knee bent
const skandasana: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="18" cy="5" r="3.5" />
    {/* torso (low, leaning) */}
    <path d="M15,9 L13,22 L23,22 L21,9 Z" />
    {/* bent knee side (right) — thigh going down-right, shin down */}
    <path d="M21,22 L28,32 L28,44 L23,44 L23,33 L17,23 Z" />
    {/* extended leg (left, going lower-left, flat and long) */}
    <path d="M15,22 L2,36 L2,40 L6,40 L7,36 L18,23 Z" />
  </>);

// Goddess — wide squat, arms in goalpost (bent up at elbows)
const goddess: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="18" cy="4" r="3.5" />
    {/* left upper arm (out to side) */}
    <rect x="5" y="14" width="10" height="5" rx="2" />
    {/* left forearm (bent up) */}
    <rect x="5" y="5" width="5" height="10" rx="2" />
    {/* right upper arm */}
    <rect x="21" y="14" width="10" height="5" rx="2" />
    {/* right forearm */}
    <rect x="26" y="5" width="5" height="10" rx="2" />
    {/* torso */}
    <rect x="14" y="8" width="8" height="13" rx="2.5" />
    {/* left thigh (wide squat, going lower-left) */}
    <path d="M14,21 L5,36 L10,38 L18,23 Z" />
    {/* right thigh */}
    <path d="M22,21 L31,36 L26,38 L18,23 Z" />
    {/* shins/feet */}
    <rect x="4" y="35" width="6" height="9" rx="3" />
    <rect x="26" y="35" width="6" height="9" rx="3" />
  </>);

// Downward Dog — inverted V, hips high
const downwardDog: SvgFn = (cls) =>
  wrap(cls, <>
    {/* body (left side: arms + torso going up-right to hips) */}
    <path d="M2,38 L2,34 Q4,20 14,12 Q18,9 18,11 Q18,9 22,12 Q32,20 34,34 L34,38 Q30,36 26,36 Q22,33 18,28 Q14,33 10,36 Q6,36 2,38 Z" />
    {/* head (small, at lower-left under arms) */}
    <circle cx="4.5" cy="39" r="3" />
    {/* heel lifts hint at feet, lower right */}
    <ellipse cx="31" cy="40" rx="4" ry="2.5" />
  </>);

// Boat — seated, legs raised, forming V shape, arms parallel to legs
const boat: SvgFn = (cls) =>
  wrap(cls, <>
    <circle cx="18" cy="5" r="3.5" />
    {/* torso (leaning back) */}
    <path d="M15,9 L11,22 L18,22 L25,22 L21,9 Z" />
    {/* legs raised (going up-right from hip) */}
    <path d="M22,21 L34,12 L35,15 L24,24 Z" />
    <path d="M14,21 L26,12 L27,15 L15,24 Z" />
    {/* arms parallel (going right) */}
    <path d="M13,18 L28,14 L28,16 L13,20 Z" />
  </>);

// ─── Lookup map ──────────────────────────────────────────────────────────────

const ILLUSTRATIONS: Record<string, SvgFn> = {
  "tree": tree,
  "eagle": eagle,
  "warrior i": warriorI,
  "warrior ii": warriorII,
  "warrior iii": warriorIII,
  "chair": chair,
  "half moon": halfMoon,
  "triangle": triangle,
  "extended side angle": extendedSideAngle,
  "crow": crow,
  "wheel": wheel,
  "camel": camel,
  "bridge": bridge,
  "pigeon": pigeon,
  "bow": bow,
  "dancing shiva": dancer,
  "dancer": dancer,
  "figure 4 balance": figure4,
  "skandasana": skandasana,
  "goddess": goddess,
  "downward dog": downwardDog,
  "boat": boat,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a filled SVG silhouette for the given pose name.
 * Falls back to a seated figure for unrecognised poses.
 */
export function getPoseIllustration(pose: string, className = ""): React.ReactElement {
  const key = pose.toLowerCase().trim();
  const factory = ILLUSTRATIONS[key] ?? seated;
  return factory(className);
}

/** True if we have a custom illustration for this pose (vs. the generic fallback). */
export function hasPoseIllustration(pose: string): boolean {
  return pose.toLowerCase().trim() in ILLUSTRATIONS;
}
