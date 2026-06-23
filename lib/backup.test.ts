import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseBackupFile, applyImport } from "./backup";
import { loadCues, rememberCue } from "./cues";

// In-memory localStorage so the storage paths run under the node test env.
function installStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

beforeEach(() => installStorage());
afterEach(() => vi.unstubAllGlobals());

const baseEnvelope = (extra: Record<string, unknown>) =>
  JSON.stringify({ schemaVersion: 3, exportedAt: "2026-06-22T00:00:00.000Z", sequences: [], ...extra });

describe("backup — cues", () => {
  it("restores cues from a v3 backup, additively and idempotently", () => {
    const cue = {
      id: "cue-1",
      pose: "Warrior II",
      text: "Kickstand the back heel.",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
      useCount: 2,
      lastUsedAt: "2026-06-10T00:00:00.000Z",
    };
    const preview = parseBackupFile(baseEnvelope({ cues: [cue] }));
    expect(preview.cuesToAdd).toBe(1);
    expect(preview.cuesToUpdate).toBe(0);

    applyImport(preview);
    expect(loadCues()).toEqual([cue]); // preserved verbatim — id, counts, timestamps

    // Re-importing the same file updates in place rather than duplicating.
    const again = parseBackupFile(baseEnvelope({ cues: [cue] }));
    expect(again.cuesToAdd).toBe(0);
    expect(again.cuesToUpdate).toBe(1);
    applyImport(again);
    expect(loadCues()).toHaveLength(1);
  });

  it("never deletes cues the file doesn't mention (restore is additive)", () => {
    rememberCue("Triangle", "Reach the top arm up.");
    const preview = parseBackupFile(baseEnvelope({ cues: [] }));
    applyImport(preview);
    expect(loadCues().map((c) => c.text)).toEqual(["Reach the top arm up."]);
  });

  it("imports an older backup with no cues field without error", () => {
    const preview = parseBackupFile(
      JSON.stringify({ schemaVersion: 2, exportedAt: "x", sequences: [], inspirations: [] }),
    );
    expect(preview.cues).toEqual([]);
    expect(preview.cuesToAdd).toBe(0);
    expect(() => applyImport(preview)).not.toThrow();
  });
});
