import { describe, expect, it } from "vitest";
import { mergeRecords, withoutExpiredTombstones, type Syncable } from "./sync-merge";

const rec = (id: string, updatedAt: string, deletedAt?: string): Syncable => ({
  id,
  updatedAt,
  ...(deletedAt ? { deletedAt } : {}),
});

describe("mergeRecords", () => {
  it("keeps the most recently updated copy of a record both sides know", () => {
    const local = [rec("a", "2026-07-01T00:00:00.000Z")];
    const remote = [rec("a", "2026-07-05T00:00:00.000Z")];
    expect(mergeRecords(local, remote)[0].updatedAt).toBe("2026-07-05T00:00:00.000Z");
    expect(mergeRecords(remote, local)[0].updatedAt).toBe("2026-07-05T00:00:00.000Z");
  });

  it("keeps the local copy on an exact tie", () => {
    const local = [{ ...rec("a", "2026-07-01T00:00:00.000Z"), side: "local" }];
    const remote = [{ ...rec("a", "2026-07-01T00:00:00.000Z"), side: "remote" }];
    expect(mergeRecords(local, remote)[0]).toMatchObject({ side: "local" });
  });

  it("unions records only one side knows, preserving local order", () => {
    const local = [rec("a", "1"), rec("b", "1")];
    const remote = [rec("c", "1")];
    expect(mergeRecords(local, remote).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("a deletion newer than the other side's edit wins (tombstone propagates)", () => {
    const local = [rec("a", "2026-07-01T00:00:00.000Z")];
    const remote = [rec("a", "2026-07-05T00:00:00.000Z", "2026-07-05T00:00:00.000Z")];
    const merged = mergeRecords(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].deletedAt).toBe("2026-07-05T00:00:00.000Z");
  });

  it("an edit newer than the deletion resurrects the record", () => {
    const local = [rec("a", "2026-07-06T00:00:00.000Z")];
    const remote = [rec("a", "2026-07-05T00:00:00.000Z", "2026-07-05T00:00:00.000Z")];
    expect(mergeRecords(local, remote)[0].deletedAt).toBeUndefined();
  });

  it("tolerates records missing updatedAt (treats them as oldest)", () => {
    const local = [{ id: "a" } as Syncable];
    const remote = [rec("a", "2026-07-05T00:00:00.000Z")];
    expect(mergeRecords(local, remote)[0].updatedAt).toBe("2026-07-05T00:00:00.000Z");
  });
});

describe("withoutExpiredTombstones", () => {
  it("drops tombstones older than the TTL, keeps fresh ones and living records", () => {
    const oldDeletion = new Date(Date.now() - 120 * 86_400_000).toISOString();
    const freshDeletion = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const records = [
      rec("living", "1"),
      rec("fresh", freshDeletion, freshDeletion),
      rec("stale", oldDeletion, oldDeletion),
    ];
    expect(withoutExpiredTombstones(records).map((r) => r.id)).toEqual(["living", "fresh"]);
  });
});
