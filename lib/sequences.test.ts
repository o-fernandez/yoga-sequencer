import { afterEach, describe, expect, it, vi } from "vitest";
import { isTaught, localTodayISO, loadSequencesRaw, isExampleSequence, type SequenceRecord } from "./sequences";
import { loadInspirationsRaw } from "./inspirations";

// In-memory localStorage so the storage paths run under the node test env.
function installStorage(windowExtras: Record<string, unknown> = {}) {
  const store = new Map<string, string>();
  vi.stubGlobal("window", windowExtras);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

describe("localTodayISO", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("zero-pads single-digit months and days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 5, 12, 0)); // March 5, local noon
    expect(localTodayISO()).toBe("2026-03-05");
  });

  it("stays on the local date late in the evening", () => {
    vi.useFakeTimers();
    // 11pm local — toISOString() would roll to the next UTC day in any
    // timezone west of UTC; the local date must not.
    vi.setSystemTime(new Date(2026, 5, 11, 23, 0));
    expect(localTodayISO()).toBe("2026-06-11");
  });

  it("treats an entry dated today as taught", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 11, 23, 0));
    expect(isTaught({ date: "2026-06-11" })).toBe(true);
    expect(isTaught({ date: "2026-06-12" })).toBe(false);
  });
});

describe("example seeding vs sync", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("seeds examples on a fresh, unsynced device", () => {
    installStorage();
    const records = loadSequencesRaw();
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((r) => isExampleSequence(r.id))).toBe(true);
  });

  it("never seeds a device that holds a sync token — the cloud copy is the library", () => {
    installStorage();
    localStorage.setItem("yoga-sync-token", "WnURpSr_X2h3RDYrDQ1b");
    expect(loadSequencesRaw()).toEqual([]);
    expect(loadInspirationsRaw()).toEqual([]);
  });

  it("never seeds while a #sync= link is being opened (before the token is adopted)", () => {
    installStorage({ location: { hash: "#sync=WnURpSr_X2h3RDYrDQ1b" } });
    expect(loadSequencesRaw()).toEqual([]);
    expect(loadInspirationsRaw()).toEqual([]);
  });

  it("skips the seed-version refresh on a synced device", () => {
    installStorage();
    const own: SequenceRecord = {
      id: "own-1",
      name: "My class",
      dates: [],
      createdAt: "2026-06-01T09:00:00.000Z",
      updatedAt: "2026-06-01T09:00:00.000Z",
      sections: [],
    };
    localStorage.setItem("yoga-sequences", JSON.stringify([own]));
    localStorage.setItem("yoga-seeds-version", "4");
    localStorage.setItem("yoga-sync-token", "WnURpSr_X2h3RDYrDQ1b");
    const records = loadSequencesRaw();
    expect(records.map((r) => r.id)).toEqual(["own-1"]);
  });
});
