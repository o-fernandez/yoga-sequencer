import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseBackupFile, applyImport } from "./backup";
import { loadCues, rememberCue } from "./cues";
import { deleteSequence, loadSequences, loadSequencesRaw, saveSequence, type SequenceRecord } from "./sequences";
import { deleteInspiration, loadInspirations, saveInspiration } from "./inspirations";

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

  it("restores a tombstoned record with a fresh updatedAt so it survives sync", () => {
    vi.useFakeTimers();
    const record: SequenceRecord = {
      id: "cls-1",
      name: "Hip freedom",
      dates: [],
      createdAt: "2026-06-01T09:00:00.000Z",
      updatedAt: "2026-06-01T09:00:00.000Z",
      sections: [],
    };

    // The class exists, then gets deleted (e.g. by "Start over") — the
    // tombstone's updatedAt is newer than anything in the backup file.
    vi.setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
    saveSequence(record);
    deleteSequence("cls-1");

    // Restoring the backup must out-timestamp the tombstone, or every synced
    // device would re-delete the record on the next merge.
    vi.setSystemTime(new Date("2026-07-12T12:00:00.000Z"));
    const preview = parseBackupFile(
      JSON.stringify({ schemaVersion: 4, exportedAt: "2026-06-20T00:00:00.000Z", sequences: [record] }),
    );
    applyImport(preview);

    const restored = loadSequences().find((s) => s.id === "cls-1");
    expect(restored).toBeDefined();
    expect(restored!.deletedAt).toBeUndefined();
    expect(restored!.updatedAt).toBe("2026-07-12T12:00:00.000Z");
    vi.useRealTimers();
  });

  it("restores a tombstoned inspiration the same way", () => {
    vi.useFakeTimers();
    const entry = {
      id: "insp-1",
      note: "Breath as architect",
      date: "2026-06-01",
      createdAt: "2026-06-01T09:00:00.000Z",
      updatedAt: "2026-06-01T09:00:00.000Z",
    };
    vi.setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
    saveInspiration(entry);
    deleteInspiration("insp-1");

    vi.setSystemTime(new Date("2026-07-12T12:00:00.000Z"));
    const preview = parseBackupFile(baseEnvelope({ inspirations: [entry] }));
    applyImport(preview);

    const restored = loadInspirations().find((e) => e.id === "insp-1");
    expect(restored).toBeDefined();
    expect(restored!.updatedAt).toBe("2026-07-12T12:00:00.000Z");
    vi.useRealTimers();
  });

  it("keeps backup timestamps verbatim when nothing local is tombstoned", () => {
    const record: SequenceRecord = {
      id: "cls-2",
      name: "Steadiness",
      dates: [],
      createdAt: "2026-06-01T09:00:00.000Z",
      updatedAt: "2026-06-01T09:00:00.000Z",
      sections: [],
    };
    const preview = parseBackupFile(
      JSON.stringify({ schemaVersion: 4, exportedAt: "2026-06-20T00:00:00.000Z", sequences: [record] }),
    );
    applyImport(preview);
    expect(loadSequencesRaw().find((s) => s.id === "cls-2")!.updatedAt).toBe("2026-06-01T09:00:00.000Z");
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
