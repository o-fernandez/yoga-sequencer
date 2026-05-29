import { describe, it, expect } from "vitest";
import { searchPoses, matchPose } from "./pose-matcher";
import { allPoses } from "./poses";

describe("pose library integrity", () => {
  it("has no duplicate pose names (duplicates break React keys and dedup)", () => {
    const names = allPoses.map((p) => p.pose);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toEqual([]);
  });
});

describe("searchPoses ranking", () => {
  it("ranks an exact full-name match first", () => {
    const results = searchPoses("savasana");
    expect(results[0].pose).toBe("Savasana");
  });

  it("ranks a prefix match ahead of fuzzy matches", () => {
    const results = searchPoses("warrior");
    expect(results[0].pose.startsWith("Warrior")).toBe(true);
  });

  it("matches Sanskrit exactly", () => {
    expect(searchPoses("tadasana")[0].pose).toBe("Mountain Pose");
  });

  it("matchPose returns high confidence on exact name", () => {
    const m = matchPose("savasana");
    expect(m.pose.pose).toBe("Savasana");
    expect(m.confidence).toBe("high");
  });

  it("still tolerates typos via fuzzy fallback", () => {
    expect(searchPoses("triangel").map((p) => p.pose)).toContain("Triangle");
    expect(searchPoses("chaturana").map((p) => p.pose)).toContain("Chaturanga");
  });

  it("keeps the result set tight for a full exact query", () => {
    // An exact full-word match should not drag in a long tail of weak matches.
    expect(searchPoses("savasana").length).toBeLessThan(12);
  });
});
