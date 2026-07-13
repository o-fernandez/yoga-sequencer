import { describe, expect, it } from "vitest";
import { filterSequences } from "./library-search";
import { normalizePoseItem, type SequenceRecord } from "./sequences";

let nextId = 0;
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

function pose(name: string, cue?: string) {
  return normalizePoseItem({ id: `p${nextId++}`, pose: name, duration: "", minutes: 0, cue });
}

const hips = makeClass({
  name: "Hip freedom",
  theme: "Creating space where we hold tension",
  themeSub: "Kapha",
  peakPose: "Pigeon",
  dates: [{ date: "2026-06-01", notes: "Skandasana into Figure 4 was the signature moment." }],
  sections: [
    { id: "s1", title: "Wind-down", secondSide: true, poses: [pose("Pigeon", "Sink and soften.")] },
  ],
});

const heart = makeClass({
  name: "Expanding what we can receive",
  theme: "Expanding what we can receive",
  themeSub: "4 · Anahata (heart)",
  peakPose: "Wheel",
  sections: [
    { id: "s2", title: "Floor", secondSide: false, poses: [pose("Bridge"), pose("Wheel")] },
  ],
});

const sketch = makeClass({
  notes: "Long holds and internal quiet. Kidney meridian.",
  sections: [{ id: "s3", title: "New section", secondSide: false, poses: [] }],
});

const all = [hips, heart, sketch];

describe("filterSequences", () => {
  it("returns everything for an empty or blank query", () => {
    expect(filterSequences(all, "")).toEqual(all);
    expect(filterSequences(all, "   ")).toEqual(all);
  });

  it("matches theme, name, and themeSub case-insensitively", () => {
    expect(filterSequences(all, "TENSION")).toEqual([hips]);
    expect(filterSequences(all, "expanding")).toEqual([heart]);
    expect(filterSequences(all, "kapha")).toEqual([hips]);
  });

  it("finds classes by a pose they contain, in English or Sanskrit", () => {
    expect(filterSequences(all, "bridge")).toEqual([heart]);
    expect(filterSequences(all, "kapotasana")).toEqual([hips]); // Pigeon's Sanskrit
  });

  it("searches scratch-pad and teaching-log notes", () => {
    expect(filterSequences(all, "kidney")).toEqual([sketch]);
    expect(filterSequences(all, "signature moment")).toEqual([hips]);
  });

  it("searches the cues written on poses", () => {
    expect(filterSequences(all, "soften")).toEqual([hips]);
  });

  it("requires every term to match (AND), so terms narrow", () => {
    expect(filterSequences(all, "wheel floor")).toEqual([heart]);
    expect(filterSequences(all, "wheel kapha")).toEqual([]);
  });

  it("ignores the default 'New section' placeholder title", () => {
    expect(filterSequences([sketch], "new section")).toEqual([]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterSequences(all, "handstand")).toEqual([]);
  });
});
