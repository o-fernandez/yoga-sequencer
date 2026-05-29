import { describe, expect, it } from "vitest";

import {
  auditSequence,
  findLastPoseIndex,
  hasPose,
  posesAfter,
} from "./sequence-audit";
import type { PoseItem, Section } from "./sequences";

let idCounter = 0;
function pose(name: string, minutes = 1): PoseItem {
  idCounter += 1;
  return { id: `p${idCounter}`, pose: name, duration: `${minutes} min`, minutes };
}

function section(
  title: string,
  poses: PoseItem[],
  opts: { secondSide?: boolean } = {},
): Section {
  idCounter += 1;
  return { id: `s${idCounter}`, title, secondSide: opts.secondSide ?? false, poses };
}

function idsOf(report: ReturnType<typeof auditSequence>): string[] {
  return report.issues.map((issue) => issue.id);
}

describe("auditSequence — safety", () => {
  it("flags a missing savasana as critical with an add action", () => {
    const report = auditSequence({
      sections: [section("Flow", [pose("Mountain"), pose("Forward Fold")])],
    });
    const savasana = report.issues.find((i) => i.id === "safety-missing-savasana");
    expect(savasana?.severity).toBe("critical");
    expect(savasana?.action).toEqual({ kind: "add_savasana", label: "Add Savasana" });
  });

  it("does not flag savasana when it is present", () => {
    const report = auditSequence({
      sections: [
        section("Flow", [pose("Mountain")]),
        section("Final Rest", [pose("Savasana", 5)]),
      ],
    });
    expect(idsOf(report)).not.toContain("safety-missing-savasana");
  });

  it("flags Wheel without a neutral reset after it", () => {
    const report = auditSequence({
      sections: [
        section("Peak", [pose("Wheel"), pose("Seated Twist")]),
        section("Final Rest", [pose("Savasana", 5)]),
      ],
    });
    const wheel = report.issues.find((i) => i.id === "safety-wheel-reset");
    expect(wheel?.severity).toBe("critical");
    expect(wheel?.action).toEqual({ kind: "add_constructive_rest", label: "Add reset" });
  });

  it("clears the Wheel reset issue when Constructive Rest follows", () => {
    const report = auditSequence({
      sections: [
        section("Peak", [pose("Wheel"), pose("Constructive Rest")]),
        section("Final Rest", [pose("Savasana", 5)]),
      ],
    });
    expect(idsOf(report)).not.toContain("safety-wheel-reset");
  });
});

describe("auditSequence — pacing", () => {
  it("warns when total minutes overshoots a 45-minute class", () => {
    const report = auditSequence({
      sections: [
        section("Flow", [pose("Mountain", 50)]),
        section("Final Rest", [pose("Savasana", 5)]),
      ],
    });
    const pacing = report.issues.find((i) => i.id === "pacing-total-45");
    expect(pacing?.severity).toBe("warning");
  });

  it("marks an over-65-minute class as critical", () => {
    const report = auditSequence({
      sections: [
        section("Flow", [pose("Mountain", 70)]),
        section("Final Rest", [pose("Savasana", 5)]),
      ],
    });
    expect(report.issues.find((i) => i.id === "pacing-total-60")?.severity).toBe("critical");
  });

  it("escalates standing-heavy sequences past 26 minutes to critical", () => {
    const report = auditSequence({
      sections: [
        section("Standing", [pose("Warrior I", 28)], { secondSide: false }),
        section("Final Rest", [pose("Savasana", 5)]),
      ],
    });
    expect(report.issues.find((i) => i.id === "pacing-standing-heavy")?.severity).toBe(
      "critical",
    );
  });

  it("flags a thin wind-down", () => {
    const report = auditSequence({
      sections: [section("Wind-down", [pose("Savasana", 3)])],
    });
    expect(report.issues.find((i) => i.id === "pacing-winddown-short")?.severity).toBe(
      "critical",
    );
  });
});

describe("auditSequence — balance", () => {
  it("flags a one-sided section and offers a both-sides action targeting that section", () => {
    const standing = section("Standing", [pose("Warrior I"), pose("Triangle")], {
      secondSide: false,
    });
    const report = auditSequence({
      sections: [standing, section("Final Rest", [pose("Savasana", 5)])],
    });
    const balance = report.issues.find((i) => i.id === `balance-${standing.id}`);
    expect(balance?.severity).toBe("warning");
    expect(balance?.action).toEqual({
      kind: "mark_both_sides",
      label: "Mark both sides",
      sectionId: standing.id,
    });
  });

  it("does not flag a section already marked as both sides", () => {
    const standing = section("Standing", [pose("Warrior I"), pose("Triangle")], {
      secondSide: true,
    });
    const report = auditSequence({
      sections: [standing, section("Final Rest", [pose("Savasana", 5)])],
    });
    expect(idsOf(report)).not.toContain(`balance-${standing.id}`);
  });
});

describe("auditSequence — peak & scoring", () => {
  it("notes a peak pose that is selected but not placed", () => {
    const report = auditSequence({
      sections: [
        section("Flow", [pose("Mountain")]),
        section("Final Rest", [pose("Savasana", 5)]),
      ],
      peakPose: "Wheel",
    });
    expect(report.issues.find((i) => i.id === "peak-missing")?.severity).toBe("warning");
  });

  it("returns an all-clear good note for a clean sequence", () => {
    const report = auditSequence({
      sections: [
        section("Flow", [pose("Mountain"), pose("Forward Fold")]),
        section("Final Rest", [pose("Savasana")]),
      ],
    });
    expect(idsOf(report)).toEqual(["all-clear"]);
    expect(report.score).toBe(100);
    expect(report.summary).toBe("Ready to teach");
  });

  it("penalizes criticals more than warnings", () => {
    const critical = auditSequence({
      sections: [section("Flow", [pose("Mountain")])],
    }).score; // missing savasana → critical
    const warning = auditSequence({
      sections: [
        section("Standing", [pose("Warrior I"), pose("Triangle")]),
        section("Final Rest", [pose("Savasana", 5)]),
      ],
    }).score; // one-sided → warning
    expect(critical).toBeLessThan(warning);
  });

  it("does not emit the all-clear note for an empty sequence", () => {
    // The audit itself has no empty special-case (it still wants a savasana);
    // the builder gates the panel behind `hasPoses`, so this never shows empty.
    const report = auditSequence({ sections: [] });
    expect(idsOf(report)).toEqual(["safety-missing-savasana"]);
    expect(idsOf(report)).not.toContain("all-clear");
  });
});

describe("exported helpers", () => {
  const sections = [
    section("A", [pose("Wheel"), pose("Pigeon")]),
    section("B", [pose("Wheel"), pose("Savasana")]),
  ];

  it("hasPose finds poses across sections", () => {
    expect(hasPose(sections, "Pigeon")).toBe(true);
    expect(hasPose(sections, "Crow")).toBe(false);
  });

  it("findLastPoseIndex returns the last occurrence", () => {
    expect(findLastPoseIndex(sections, "Wheel")).toEqual({ sectionIndex: 1, poseIndex: 0 });
    expect(findLastPoseIndex(sections, "Crow")).toBeNull();
  });

  it("posesAfter lists everything following a location", () => {
    const loc = findLastPoseIndex(sections, "Wheel")!;
    expect(posesAfter(sections, loc)).toEqual(["Savasana"]);
  });
});
