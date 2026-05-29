import { describe, it, expect } from "vitest";
import { searchPoses, matchPose } from "./pose-matcher";

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
});
