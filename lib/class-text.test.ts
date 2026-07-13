import { describe, expect, it } from "vitest";
import { classAsText } from "./class-text";
import { normalizePoseItem, type SequenceRecord } from "./sequences";

let nextId = 0;
function pose(name: string, cue?: string, breaths?: number) {
  return normalizePoseItem({
    id: `p${nextId++}`, pose: name, duration: "", minutes: 0,
    ...(cue ? { cue } : {}), ...(breaths ? { breaths } : {}),
  });
}

function makeClass(overrides: Partial<SequenceRecord>): SequenceRecord {
  return {
    id: `seq${nextId++}`,
    name: "",
    dates: [],
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
    sections: [],
    ...overrides,
  };
}

describe("classAsText", () => {
  it("writes name, theme with its tag, and the peak/time line", () => {
    const text = classAsText(makeClass({
      name: "Hip freedom",
      theme: "Creating space where we hold tension",
      themeType: "season",
      themeSub: "Kapha",
      peakPose: "Pigeon",
      sections: [
        { id: "s1", title: "Wind-down", secondSide: false, poses: [pose("Pigeon", undefined, 8)] },
      ],
    }));
    const lines = text.split("\n");
    expect(lines[0]).toBe("Hip freedom");
    expect(lines[1]).toBe("Creating space where we hold tension · Kapha season");
    expect(lines[2]).toMatch(/^Peak: Pigeon · ~\d+-min class$/);
  });

  it("doesn't repeat the theme when it doubles as the name", () => {
    const text = classAsText(makeClass({
      name: "Expanding what we can receive",
      theme: "Expanding what we can receive",
      sections: [{ id: "s1", title: "Floor", secondSide: false, poses: [pose("Wheel")] }],
    }));
    expect(text.split("\n")[0]).toBe("Expanding what we can receive");
    expect(text.match(/Expanding what we can receive/g)).toHaveLength(1);
  });

  it("annotates rounds and both sides on the section heading", () => {
    const text = classAsText(makeClass({
      name: "Test",
      sections: [
        { id: "s1", title: "Surya A", secondSide: false, rounds: 3, poses: [pose("Plank")] },
        { id: "s2", title: "Neutral hips", secondSide: true, poses: [pose("Low Lunge")] },
        { id: "s3", title: "Round 1", secondSide: true, rounds: 2, poses: [pose("Warrior I")] },
      ],
    }));
    expect(text).toContain("Surya A — 3 rounds");
    expect(text).toContain("Neutral hips — both sides");
    expect(text).toContain("Round 1 — 2 rounds · both sides");
  });

  it("lists poses with breaths and indents cues in quotes", () => {
    const text = classAsText(makeClass({
      name: "Test",
      sections: [
        {
          id: "s1", title: "Standing", secondSide: false,
          poses: [pose("Skandasana", "Fly your warrior sideways", 5), pose("Mountain Pose", undefined, 1)],
        },
      ],
    }));
    expect(text).toContain("· Skandasana — 5 breaths");
    expect(text).toContain('    “Fly your warrior sideways”');
    expect(text).toContain("· Mountain Pose — 1 breath");
  });

  it("skips empty sections and journal content entirely", () => {
    const text = classAsText(makeClass({
      name: "Test",
      notes: "PRIVATE scratch pad",
      dates: [{ date: "2026-06-01", notes: "PRIVATE log note" }],
      sections: [
        { id: "s1", title: "Opening meditation", secondSide: false, poses: [] },
        { id: "s2", title: "Standing", secondSide: false, poses: [pose("Warrior II")] },
      ],
    }));
    expect(text).not.toContain("Opening meditation");
    expect(text).not.toContain("PRIVATE");
  });

  it("falls back to the theme as title, and omits the meta line when empty", () => {
    const text = classAsText(makeClass({ theme: "Letting go", peakPose: undefined }));
    expect(text).toBe("Letting go");
  });
});
