import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPoseMemory, poseMemoryNote } from "./pose-memory";
import type { SequenceRecord } from "./sequences";

function seq(
  id: string,
  dates: string[],
  poseNames: string[],
): SequenceRecord {
  return {
    id,
    name: id,
    dates: dates.map((date) => ({ date })),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    sections: [
      {
        id: `${id}-s`,
        title: "Section",
        secondSide: false,
        poses: poseNames.map((pose, i) => ({
          id: `${id}-${i}`,
          pose,
          duration: "5 breaths",
          minutes: 1,
        })),
      },
    ],
  };
}

describe("pose memory", () => {
  afterEach(() => vi.useRealTimers());

  function fixtures(): SequenceRecord[] {
    return [
      seq("recent", ["2026-06-10"], ["Downward Dog", "Pigeon"]),
      seq("cold", ["2026-03-01"], ["Crow"]),
      seq("planned", ["2026-07-01"], ["Wheel"]),
    ];
  }

  it("counts only classes with a past taught date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 13, 12, 0));
    const memory = buildPoseMemory(fixtures());
    expect(memory.taughtClassCount).toBe(2); // recent + cold, not the planned-only class
  });

  it("stays silent for a pose in regular rotation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 13, 12, 0));
    const memory = buildPoseMemory(fixtures());
    expect(poseMemoryNote("Downward Dog", memory, true)).toBeNull();
  });

  it("flags a cold pose with months since last taught", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 13, 12, 0));
    const memory = buildPoseMemory(fixtures());
    const note = poseMemoryNote("Crow", memory, false);
    expect(note?.tone).toBe("cold");
    expect(note?.text).toBe("Haven't taught this in 3 months");
  });

  it("flags a never-taught pose only in focused search", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 13, 12, 0));
    const memory = buildPoseMemory(fixtures());
    expect(poseMemoryNote("Camel", memory, true)?.tone).toBe("new");
    expect(poseMemoryNote("Camel", memory, false)).toBeNull();
  });

  it("treats a pose living only in a planned class as never taught", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 13, 12, 0));
    const memory = buildPoseMemory(fixtures());
    expect(poseMemoryNote("Wheel", memory, true)?.tone).toBe("new");
  });

  it("says nothing at all when no class has been taught yet", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 13, 12, 0));
    const memory = buildPoseMemory([seq("planned", ["2026-07-01"], ["Crow"])]);
    expect(poseMemoryNote("Crow", memory, true)).toBeNull();
  });
});
