import { describe, expect, it } from "vitest";
import { sectionsReducer } from "./sections-reducer";
import { normalizePoseItem, type Section } from "./sequences";

let nextId = 0;
function pose(name: string) {
  return normalizePoseItem({ id: `p${nextId++}`, pose: name, duration: "", minutes: 0 });
}

function section(id: string, title: string, poseNames: string[]): Section {
  return { id, title, secondSide: false, poses: poseNames.map(pose) };
}

function names(sections: Section[]): string[][] {
  return sections.map((s) => s.poses.map((p) => p.pose));
}

describe("move_pose", () => {
  it("swaps with the neighbor inside a section", () => {
    const s = [section("a", "Standing", ["Warrior I", "Warrior II", "Triangle"])];
    const next = sectionsReducer(s, {
      type: "move_pose", sectionId: "a", poseId: s[0].poses[2].id, dir: -1,
    });
    expect(names(next)).toEqual([["Warrior I", "Triangle", "Warrior II"]]);
  });

  it("hops to the end of the previous non-empty section, skipping empty ones", () => {
    const s = [
      section("a", "Warm-up", ["Cat/Cow"]),
      section("b", "Empty", []),
      section("c", "Standing", ["Warrior I", "Warrior II"]),
    ];
    const next = sectionsReducer(s, {
      type: "move_pose", sectionId: "c", poseId: s[2].poses[0].id, dir: -1,
    });
    expect(names(next)).toEqual([["Cat/Cow", "Warrior I"], [], ["Warrior II"]]);
  });

  it("hops to the start of the next non-empty section at the bottom edge", () => {
    const s = [
      section("a", "Standing", ["Warrior I"]),
      section("b", "Floor", ["Sphinx"]),
    ];
    const next = sectionsReducer(s, {
      type: "move_pose", sectionId: "a", poseId: s[0].poses[0].id, dir: 1,
    });
    expect(names(next)).toEqual([[], ["Warrior I", "Sphinx"]]);
  });

  it("is a no-op at the very start of the sequence", () => {
    const s = [section("a", "Warm-up", ["Cat/Cow", "Child's Pose"])];
    const next = sectionsReducer(s, {
      type: "move_pose", sectionId: "a", poseId: s[0].poses[0].id, dir: -1,
    });
    expect(next).toBe(s);
  });
});

describe("add_pose", () => {
  it("appends by default and inserts after a given pose when asked", () => {
    const s = [section("a", "Standing", ["Warrior I", "Triangle"])];
    const appended = sectionsReducer(s, { type: "add_pose", sectionId: "a", pose: "Eagle" });
    expect(names(appended)).toEqual([["Warrior I", "Triangle", "Eagle"]]);

    const inserted = sectionsReducer(s, {
      type: "add_pose", sectionId: "a", pose: "Eagle", afterPoseId: s[0].poses[0].id,
    });
    expect(names(inserted)).toEqual([["Warrior I", "Eagle", "Triangle"]]);
    // New poses come out normalized (breath defaults from the pose library).
    expect(inserted[0].poses[1].breaths).toBeGreaterThan(0);
  });
});

describe("section edits", () => {
  it("normalizes rounds of 1 back to undefined", () => {
    const s = [section("a", "Surya A", ["Plank"])];
    const up = sectionsReducer(s, { type: "set_rounds", sectionId: "a", rounds: 3 });
    expect(up[0].rounds).toBe(3);
    const down = sectionsReducer(up, { type: "set_rounds", sectionId: "a", rounds: 1 });
    expect(down[0].rounds).toBeUndefined();
  });

  it("moves a section and refuses to move past the edges", () => {
    const s = [section("a", "One", []), section("b", "Two", [])];
    const moved = sectionsReducer(s, { type: "move_section", sectionId: "b", dir: -1 });
    expect(moved.map((x) => x.id)).toEqual(["b", "a"]);
    expect(sectionsReducer(s, { type: "move_section", sectionId: "a", dir: -1 })).toBe(s);
  });
});

describe("pose edits", () => {
  it("sets and clears a cue", () => {
    const s = [section("a", "Standing", ["Warrior II"])];
    const id = s[0].poses[0].id;
    const withCue = sectionsReducer(s, { type: "set_cue", poseId: id, cue: "Front knee tracks the toe." });
    expect(withCue[0].poses[0].cue).toBe("Front knee tracks the toe.");
    const cleared = sectionsReducer(withCue, { type: "set_cue", poseId: id, cue: "" });
    expect(cleared[0].poses[0].cue).toBeUndefined();
  });

  it("toggles the theme marker on and off", () => {
    const s = [section("a", "Standing", ["Triangle"])];
    const id = s[0].poses[0].id;
    const on = sectionsReducer(s, { type: "toggle_theme_pose", poseId: id });
    expect(on[0].poses[0].themePose).toBe(true);
    const off = sectionsReducer(on, { type: "toggle_theme_pose", poseId: id });
    expect(off[0].poses[0].themePose).toBeUndefined();
  });
});

describe("apply_audit_action", () => {
  it("adds Savasana to an existing closing section", () => {
    const s = [
      section("a", "Standing", ["Warrior I"]),
      section("b", "Closing", ["Supine Twist"]),
    ];
    const next = sectionsReducer(s, {
      type: "apply_audit_action",
      action: { kind: "add_savasana", label: "Add Savasana" },
    });
    expect(names(next)[1]).toEqual(["Supine Twist", "Savasana"]);
  });

  it("creates a Savasana section before a trailing empty one when no close exists", () => {
    const s = [section("a", "Standing", ["Warrior I"]), section("b", "New section", [])];
    const next = sectionsReducer(s, {
      type: "apply_audit_action",
      action: { kind: "add_savasana", label: "Add Savasana" },
    });
    expect(next.map((x) => x.title)).toEqual(["Standing", "Savasana", "New section"]);
  });

  it("does nothing when Savasana is already placed", () => {
    const s = [section("a", "Closing", ["Savasana"])];
    const next = sectionsReducer(s, {
      type: "apply_audit_action",
      action: { kind: "add_savasana", label: "Add Savasana" },
    });
    expect(next).toBe(s);
  });

  it("inserts Constructive Rest right after the last Wheel, once", () => {
    const s = [section("a", "Floor", ["Bridge", "Wheel", "Supta Baddhakonasana"])];
    const next = sectionsReducer(s, {
      type: "apply_audit_action",
      action: { kind: "add_constructive_rest", label: "Add reset" },
    });
    expect(names(next)).toEqual([["Bridge", "Wheel", "Constructive Rest", "Supta Baddhakonasana"]]);

    const again = sectionsReducer(next, {
      type: "apply_audit_action",
      action: { kind: "add_constructive_rest", label: "Add reset" },
    });
    expect(again).toBe(next);
  });

  it("marks a section as both sides", () => {
    const s = [section("a", "Standing", ["Warrior I"])];
    const next = sectionsReducer(s, {
      type: "apply_audit_action",
      action: { kind: "mark_both_sides", label: "Mark both sides", sectionId: "a" },
    });
    expect(next[0].secondSide).toBe(true);
  });
});
