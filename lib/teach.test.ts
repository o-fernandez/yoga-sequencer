import { describe, expect, it } from "vitest";
import { buildTeachSteps } from "./teach";
import { normalizePoseItem, type Section } from "./sequences";

function pose(name: string) {
  return normalizePoseItem({ id: name, pose: name, duration: "", minutes: 0 });
}

describe("buildTeachSteps", () => {
  it("threads the library's modifications onto each step", () => {
    const sections: Section[] = [
      { id: "s1", title: "Floor", secondSide: false, poses: [pose("Downward Dog"), pose("Sphinx")] },
    ];
    const steps = buildTeachSteps(sections);
    expect(steps[0].modifications).toContain(
      "Bend knees generously to find length in the spine",
    );
    // Sphinx has no modifications in the library — the row shows no options.
    expect(steps[1].modifications).toBeUndefined();
  });

  it("expands both-sides sections into two labelled passes", () => {
    const sections: Section[] = [
      { id: "s1", title: "Standing", secondSide: true, poses: [pose("Warrior II")] },
    ];
    const steps = buildTeachSteps(sections);
    expect(steps.map((s) => s.sideLabel)).toEqual(["First side", "Second side"]);
    expect(steps.map((s) => s.id)).toEqual(["s1::a::Warrior II", "s1::b::Warrior II"]);
  });
});
