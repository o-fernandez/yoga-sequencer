import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  allCues,
  cuesForPose,
  deleteCue,
  loadCues,
  rememberCue,
  searchCues,
  updateCue,
} from "./cues";

// Minimal in-memory localStorage so the module's storage path runs under the
// default node test environment.
function installStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {}); // satisfy the module's SSR guard
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

beforeEach(() => {
  installStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("rememberCue", () => {
  it("keeps a written cue, grouped by pose", () => {
    rememberCue("Warrior II", "Front knee tracks the middle toe.");
    const all = loadCues();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      pose: "Warrior II",
      text: "Front knee tracks the middle toe.",
      useCount: 1,
    });
  });

  it("ignores empty / whitespace-only text", () => {
    rememberCue("Warrior II", "   ");
    rememberCue("Warrior II", "");
    expect(loadCues()).toHaveLength(0);
  });

  it("bumps recency/frequency instead of duplicating the same cue on the same pose", () => {
    rememberCue("Triangle", "Reach through the top fingertips.");
    rememberCue("Triangle", "  reach through the TOP   fingertips.  "); // same words, different case/spacing
    const all = loadCues();
    expect(all).toHaveLength(1);
    expect(all[0].useCount).toBe(2);
    // original wording is preserved
    expect(all[0].text).toBe("Reach through the top fingertips.");
  });

  it("keeps the same words on a different pose as a separate entry", () => {
    rememberCue("Triangle", "Lengthen the side body.");
    rememberCue("Gate Pose", "Lengthen the side body.");
    expect(loadCues()).toHaveLength(2);
  });

  it("keeps a different wording on the same pose as a separate entry", () => {
    rememberCue("Triangle", "Reach the top arm to the sky.");
    rememberCue("Triangle", "Spin the heart open to the ceiling.");
    expect(cuesForPose("Triangle")).toHaveLength(2);
  });
});

describe("cuesForPose", () => {
  it("returns only that pose's cues, most recent first", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    rememberCue("Triangle", "First cue.");
    vi.setSystemTime(new Date("2026-02-01T00:00:00Z"));
    rememberCue("Triangle", "Second cue.");
    rememberCue("Warrior II", "Unrelated.");
    vi.useRealTimers();

    const list = cuesForPose("Triangle");
    expect(list.map((c) => c.text)).toEqual(["Second cue.", "First cue."]);
  });
});

describe("searchCues", () => {
  beforeEach(() => {
    rememberCue("Gate Pose", "Lengthen the side body.");
    rememberCue("Warrior II", "Kickstand the back heel.");
  });

  it("matches on the cue's words", () => {
    expect(searchCues("side body").map((c) => c.text)).toEqual([
      "Lengthen the side body.",
    ]);
    expect(searchCues("kickstand").map((c) => c.text)).toEqual([
      "Kickstand the back heel.",
    ]);
  });

  it("matches on the pose name", () => {
    expect(searchCues("gate").map((c) => c.pose)).toEqual(["Gate Pose"]);
  });

  it("returns everything for an empty query", () => {
    expect(searchCues("  ")).toHaveLength(2);
  });
});

describe("updateCue / deleteCue", () => {
  it("rewords a cue without changing its identity or use count", () => {
    rememberCue("Triangle", "Reach the top arm up.");
    rememberCue("Triangle", "Reach the top arm up."); // useCount → 2
    const id = loadCues()[0].id;
    updateCue(id, "Reach the top arm to the sky.");
    const entry = loadCues()[0];
    expect(entry.id).toBe(id);
    expect(entry.text).toBe("Reach the top arm to the sky.");
    expect(entry.useCount).toBe(2);
  });

  it("ignores an empty reword", () => {
    rememberCue("Triangle", "Original.");
    updateCue(loadCues()[0].id, "   ");
    expect(loadCues()[0].text).toBe("Original.");
  });

  it("removes a cue from the library", () => {
    rememberCue("Triangle", "Keep this.");
    rememberCue("Warrior II", "Remove this.");
    const target = loadCues().find((c) => c.text === "Remove this.")!;
    deleteCue(target.id);
    expect(allCues().map((c) => c.text)).toEqual(["Keep this."]);
  });
});
